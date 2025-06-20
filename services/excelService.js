import ExcelJS from 'exceljs';
import ModelClient, { isUnexpected } from "@azure-rest/ai-inference";
import { AzureKeyCredential } from "@azure/core-auth";
import { 
  Organization, 
  User, 
  LeaveBalance, 
  PayrollData, 
  CompanyPolicy,
  sequelize 
} from '../models/index.js';
import bcrypt from 'bcryptjs';

class ExcelProcessingService {
  constructor() {
    this.llmClient = ModelClient(
      process.env.LLM_ENDPOINT,
      new AzureKeyCredential(process.env.GITHUB_TOKEN)
    );
  }

  async processEmployeeExcel(filePath, organizationId) {
    try {
      // Read Excel file
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.readFile(filePath);
      
      // Extract data to string format
      const excelData = this.extractExcelDataToString(workbook);
      
      // Get organization details
      const organization = await Organization.findByPk(organizationId);
      if (!organization) {
        throw new Error('Organization not found');
      }

      // Check user limits based on subscription plan
      const currentUserCount = await User.count({
        where: { organization_id: organizationId, is_active: true }
      });

      const maxUsers = this.getMaxUsersForPlan(organization.subscription_plan);
      
      // Process with LLM
      const processedData = await this.processWithLLM(excelData, organizationId, organization);
      
      // Validate user count limits
      if (currentUserCount + processedData.employees.length > maxUsers) {
        throw new Error(`User limit exceeded. Your ${organization.subscription_plan} plan allows maximum ${maxUsers} users. Current: ${currentUserCount}, Attempting to add: ${processedData.employees.length}`);
      }

      // Insert data in transaction
      const result = await sequelize.transaction(async (t) => {
        const insertedEmployees = [];
        
        for (const empData of processedData.employees) {
          // Generate unique user_id
          const userId = `${organizationId}_${empData.employee_number || Date.now()}`;
          
          // Hash default password (date of birth)
          const defaultPassword = empData.date_of_birth || '01011990'; // fallback
          const hashedPassword = await bcrypt.hash(defaultPassword, 10);
          
          // Insert user
          const user = await User.create({
            user_id: userId,
            organization_id: organizationId,
            first_name: empData.first_name,
            last_name: empData.last_name,
            email: empData.email,
            password_hash: hashedPassword,
            role: empData.role || 'Employee',
            date_of_joining: empData.date_of_joining,
            date_of_birth: empData.date_of_birth,
            department: empData.department,
            location: empData.location,
            phone: empData.phone,
            employee_number: empData.employee_number,
            password_reset_required: true
          }, { transaction: t });

          // Insert leave balances
          if (empData.leave_balances) {
            for (const leave of empData.leave_balances) {
              await LeaveBalance.create({
                organization_id: organizationId,
                user_id: userId,
                leave_type: leave.type,
                total_allotted: leave.allotted,
                leaves_taken: leave.taken || 0,
                leaves_pending_approval: leave.pending || 0
              }, { transaction: t });
            }
          }

          // Insert payroll data
          if (empData.payroll) {
            await PayrollData.create({
              organization_id: organizationId,
              user_id: userId,
              base_salary: empData.payroll.base_salary,
              hra: empData.payroll.hra || 0,
              conveyance_allowance: empData.payroll.conveyance_allowance || 0,
              medical_allowance: empData.payroll.medical_allowance || 0,
              pf_deduction: empData.payroll.pf_deduction || 0,
              esi_deduction: empData.payroll.esi_deduction || 0,
              professional_tax: empData.payroll.professional_tax || 0,
              ctc: empData.payroll.ctc
            }, { transaction: t });
          }

          insertedEmployees.push({
            user_id: userId,
            name: `${empData.first_name} ${empData.last_name}`,
            email: empData.email,
            default_password: defaultPassword
          });
        }

        return insertedEmployees;
      });

      return {
        success: true,
        message: `Successfully processed ${result.length} employees`,
        data: result
      };

    } catch (error) {
      console.error('Excel processing error:', error);
      throw error;
    }
  }

  extractExcelDataToString(workbook) {
    let dataString = "Employee Data from Excel:\n\n";
    
    workbook.eachSheet((worksheet, sheetId) => {
      dataString += `Sheet: ${worksheet.name}\n`;
      dataString += "Headers: ";
      
      // Get headers from first row
      const headerRow = worksheet.getRow(1);
      const headers = [];
      headerRow.eachCell((cell, colNumber) => {
        headers.push(cell.value);
      });
      dataString += headers.join(" | ") + "\n";
      
      // Get data rows
      worksheet.eachRow((row, rowNumber) => {
        if (rowNumber > 1) { // Skip header row
          const rowData = [];
          row.eachCell((cell, colNumber) => {
            rowData.push(cell.value);
          });
          dataString += rowData.join(" | ") + "\n";
        }
      });
      
      dataString += "\n";
    });
    
    return dataString;
  }

  async processWithLLM(excelData, organizationId, organization) {
    try {
      const systemPrompt = `You are an expert HR data processor. You need to extract employee information from Excel data and structure it properly for database insertion.

Organization Details:
- Organization ID: ${organizationId}
- Organization Name: ${organization.org_name}
- Subscription Plan: ${organization.subscription_plan}

Database Schema Requirements:
1. Users Table: user_id, organization_id, first_name, last_name, email, role, date_of_joining, date_of_birth, department, location, phone, employee_number
2. Leave Balances: leave_type (Casual Leave, Sick Leave, Earned Leave), total_allotted, leaves_taken, leaves_pending_approval
3. Payroll Data: base_salary, hra, conveyance_allowance, medical_allowance, pf_deduction, esi_deduction, professional_tax, ctc

Instructions:
- Extract employee data and map to proper fields
- Use date_of_birth as default password (format: DDMMYYYY)
- Set default leave balances if not provided: Casual: 12, Sick: 8, Earned: 18
- Calculate missing payroll components if basic salary is provided
- Set non-essential fields as null if not available
- Return structured JSON with employees array

Please process the following Excel data and return ONLY valid JSON:`;

      const userPrompt = `${excelData}

Return the processed data as JSON in this exact structure:
{
  "employees": [
    {
      "first_name": "string",
      "last_name": "string", 
      "email": "string",
      "role": "Employee|Manager|Admin",
      "date_of_joining": "YYYY-MM-DD",
      "date_of_birth": "YYYY-MM-DD",
      "department": "string",
      "location": "string",
      "phone": "string",
      "employee_number": "string",
      "leave_balances": [
        {"type": "Casual Leave", "allotted": 12, "taken": 0, "pending": 0},
        {"type": "Sick Leave", "allotted": 8, "taken": 0, "pending": 0},
        {"type": "Earned Leave", "allotted": 18, "taken": 0, "pending": 0}
      ],
      "payroll": {
        "base_salary": number,
        "hra": number,
        "conveyance_allowance": number,
        "medical_allowance": number,
        "pf_deduction": number,
        "esi_deduction": number,
        "professional_tax": number,
        "ctc": number
      }
    }
  ]
}`;

      const response = await this.llmClient.path("/chat/completions").post({
        body: {
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt }
          ],
          temperature: 0.1,
          top_p: 0.9,
          model: process.env.LLM_MODEL,
          max_tokens: 4000
        }
      });

      if (isUnexpected(response)) {
        throw new Error(response.body.error);
      }

      const llmResponse = response.body.choices[0].message.content;
      
      // Parse JSON response
      const jsonMatch = llmResponse.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('Invalid JSON response from LLM');
      }

      const processedData = JSON.parse(jsonMatch[0]);
      
      // Validate structure
      if (!processedData.employees || !Array.isArray(processedData.employees)) {
        throw new Error('Invalid data structure from LLM');
      }

      return processedData;

    } catch (error) {
      console.error('LLM processing error:', error);
      throw new Error(`Failed to process Excel data with LLM: ${error.message}`);
    }
  }

  getMaxUsersForPlan(plan) {
    const limits = {
      'starter': 50,
      'pro': 500,
      'enterprise': 5000
    };
    return limits[plan] || 50;
  }
}

export default new ExcelProcessingService();
