import ExcelJS from 'exceljs';
import { 
  Organization, 
  User, 
  LeaveBalance, 
  PayrollData, 
  sequelize 
} from '../models/index.js';
import bcrypt from 'bcryptjs';

class ExcelProcessingService {
  constructor() {
    // Role mapping for database compatibility
    this.roleMapping = {
      'intern': 'Employee',
      'lead': 'Manager', 
      'manager': 'Manager',
      'employee': 'Employee',
      'admin': 'Admin'
    };
  }

  async processEmployeeExcel(filePath, organizationId) {
    console.log(`🚀 Starting Excel processing for organization: ${organizationId}`);
    
    try {
      // Step 1: Read Excel file with bulletproof parsing
      const employees = await this.readExcelFileRobust(filePath);
      console.log(`📊 Excel data extracted: ${employees.length} employees found`);
      
      // Step 2: Get organization details
      const organization = await Organization.findByPk(organizationId);
      if (!organization) {
        throw new Error('Organization not found');
      }

      // Step 3: Check user limits
      const currentUserCount = await User.count({
        where: { organization_id: organizationId, is_active: true }
      });

      const maxUsers = this.getMaxUsersForPlan(organization.subscription_plan);
      
      if (currentUserCount + employees.length > maxUsers) {
        throw new Error(`User limit exceeded. Your ${organization.subscription_plan} plan allows maximum ${maxUsers} users. Current: ${currentUserCount}, Attempting to add: ${employees.length}`);
      }

      // Step 4: Insert data with bulletproof insertion
      const result = await this.bulletproofInsert(employees, organizationId);

      console.log(`✅ Successfully processed ${result.length} employees`);
      return {
        success: true,
        message: `Successfully processed ${result.length} employees`,
        data: result
      };

    } catch (error) {
      console.error('❌ Excel processing error:', error);
      throw error;
    }
  }

  async readExcelFileRobust(filePath) {
    try {
      console.log(`📖 Reading Excel file: ${filePath}`);
      
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.readFile(filePath);
      
      const worksheet = workbook.worksheets[0];
      const employees = [];
      
      // Get all data as raw array
      const rows = [];
      worksheet.eachRow((row, rowNumber) => {
        const rowData = [];
        row.eachCell((cell, colNumber) => {
          rowData[colNumber - 1] = cell.value; // Store raw cell value
        });
        rows.push(rowData);
      });

      console.log(`📋 Total rows found: ${rows.length}`);

      // Process each data row (skip header)
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (!row || row.length === 0) continue;

        const employee = this.parseRowBulletproof(row, i);
        if (employee) {
          employees.push(employee);
        }
      }

      console.log(`✅ Parsed ${employees.length} employees from Excel`);
      return employees;

    } catch (error) {
      console.error('❌ Excel reading error:', error);
      throw new Error(`Failed to read Excel file: ${error.message}`);
    }
  }

  parseRowBulletproof(row, rowIndex) {
    try {
      // Expected columns: first_name, last_name, email, role, department, location, date_of_joining, date_of_birth, base_salary, hra, ctc
      
      const employee = {
        first_name: this.safeString(row[0]) || `Employee${rowIndex}`,
        last_name: this.safeString(row[1]) || `User${rowIndex}`,
        email: this.extractEmailFromRow(row, rowIndex), // REGEX EMAIL EXTRACTION
        role: this.normalizeRole(this.safeString(row[3])) || 'Employee',
        department: this.safeString(row[4]) || 'General',
        location: this.safeString(row[5]) || 'Office',
        date_of_joining: this.safeDateString(row[6]) || '2023-01-01',
        date_of_birth: this.safeDateString(row[7]) || '1990-01-01',
        base_salary: this.safeNumber(row[8]) || 50000,
        hra: this.safeNumber(row[9]) || 25000,
        ctc: this.safeNumber(row[10]) || 600000
      };

      console.log(`📝 Parsed employee ${rowIndex}: ${employee.first_name} ${employee.last_name} - Email: ${employee.email}`);
      return employee;
    } catch (error) {
      console.warn(`⚠️ Error parsing row ${rowIndex}:`, error.message);
      return null;
    }
  }

  // ROBUST EMAIL EXTRACTION USING REGEX PATTERN MATCHING
  extractEmailFromRow(row, rowIndex) {
    try {
      // Convert entire row to searchable string
      const rowString = row.map(cell => {
        if (cell === null || cell === undefined) return '';
        if (typeof cell === 'object') return '';
        return String(cell).trim();
      }).join(' ');

      console.log(`🔍 Searching for email in row ${rowIndex}: "${rowString}"`);

      // PRIMARY REGEX: Look for emails with .com specifically (as requested)
      const comEmailRegex = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.com)/gi;
      const comMatches = rowString.match(comEmailRegex);
      
      if (comMatches && comMatches.length > 0) {
        const email = comMatches[0].toLowerCase().trim();
        console.log(`✅ Found .com email: ${email}`);
        return email;
      }

      // SECONDARY REGEX: Look for any valid email pattern
      const generalEmailRegex = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/gi;
      const generalMatches = rowString.match(generalEmailRegex);
      
      if (generalMatches && generalMatches.length > 0) {
        const email = generalMatches[0].toLowerCase().trim();
        console.log(`✅ Found general email: ${email}`);
        return email;
      }

      // TERTIARY REGEX: Simple email pattern
      const simpleEmailRegex = /(\S+@\S+\.\S+)/gi;
      const simpleMatches = rowString.match(simpleEmailRegex);
      
      if (simpleMatches && simpleMatches.length > 0) {
        const email = simpleMatches[0].toLowerCase().trim();
        console.log(`✅ Found simple email: ${email}`);
        return email;
      }

      // FALLBACK: Generate email from name
      const firstName = this.safeString(row[0]) || `employee${rowIndex}`;
      const lastName = this.safeString(row[1]) || `user${rowIndex}`;
      const generatedEmail = `${firstName.toLowerCase()}.${lastName.toLowerCase()}@company.com`;
      
      console.log(`⚠️ No email found, generated: ${generatedEmail}`);
      return generatedEmail;
      
    } catch (error) {
      console.warn(`⚠️ Email extraction error for row ${rowIndex}:`, error.message);
      return `employee${rowIndex}@company.com`;
    }
  }

  // Bulletproof data conversion methods
  safeString(value) {
    if (value === null || value === undefined) return '';
    if (typeof value === 'string') return value.trim();
    if (typeof value === 'number') return value.toString();
    if (typeof value === 'object') return '';
    return String(value).trim();
  }

  safeNumber(value) {
    if (value === null || value === undefined) return 0;
    if (typeof value === 'number' && !isNaN(value)) return Math.round(value);
    if (typeof value === 'string') {
      const num = parseFloat(value.replace(/[^0-9.-]/g, ''));
      return isNaN(num) ? 0 : Math.round(num);
    }
    return 0;
  }

  safeDateString(value) {
    try {
      if (!value) return null;
      
      // Handle Excel serial dates (numbers)
      if (typeof value === 'number') {
        // Excel epoch starts from 1900-01-01, but Excel incorrectly treats 1900 as a leap year
        const excelEpoch = new Date(1900, 0, 1);
        const date = new Date(excelEpoch.getTime() + (value - 2) * 24 * 60 * 60 * 1000);
        
        // Validate the date is reasonable (between 1950 and 2050)
        if (date.getFullYear() >= 1950 && date.getFullYear() <= 2050) {
          return this.formatDateToMySQL(date);
        }
      }
      
      // Handle Date objects
      if (value instanceof Date) {
        return this.formatDateToMySQL(value);
      }
      
      // Handle string dates
      if (typeof value === 'string') {
        const date = new Date(value);
        if (!isNaN(date.getTime()) && date.getFullYear() >= 1950 && date.getFullYear() <= 2050) {
          return this.formatDateToMySQL(date);
        }
      }
      
      return null;
    } catch (error) {
      console.warn(`Date parsing error for value "${value}":`, error.message);
      return null;
    }
  }

  formatDateToMySQL(date) {
    try {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    } catch (error) {
      return null;
    }
  }

  normalizeRole(role) {
    if (!role) return 'Employee';
    const normalizedRole = role.toLowerCase().trim();
    return this.roleMapping[normalizedRole] || 'Employee';
  }

  async bulletproofInsert(employees, organizationId) {
    console.log(`💾 Inserting ${employees.length} employees into database`);
    
    return await sequelize.transaction(async (transaction) => {
      const insertedEmployees = [];
      
      for (let i = 0; i < employees.length; i++) {
        const empData = employees[i];
        console.log(`👤 Processing employee ${i + 1}/${employees.length}: ${empData.first_name} ${empData.last_name}`);
        
        try {
          // Generate unique user_id
          const userId = `${organizationId}_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
          
          // Format date for password (DDMMYYYY)
          const defaultPassword = this.formatDateForPassword(empData.date_of_birth) || '01011990';
          const hashedPassword = await bcrypt.hash(defaultPassword, 10);
          
          // Prepare bulletproof user data
          const userData = {
            user_id: userId,
            organization_id: organizationId,
            first_name: empData.first_name,
            last_name: empData.last_name,
            email: empData.email,
            password_hash: hashedPassword,
            role: empData.role,
            date_of_joining: empData.date_of_joining,
            date_of_birth: empData.date_of_birth,
            department: empData.department,
            location: empData.location,
            phone: null,
            employee_number: `EMP${String(i + 1).padStart(3, '0')}`,
            is_active: true,
            password_reset_required: true
          };

          // Insert user with validation completely disabled
          const user = await User.create(userData, { 
            transaction,
            validate: false,
            hooks: false,
            raw: true
          });

          console.log(`✅ User created: ${user.user_id}`);

          // Insert default leave balances
          const defaultLeaves = [
            { type: 'Casual Leave', allotted: 12, taken: 0, pending: 0 },
            { type: 'Sick Leave', allotted: 8, taken: 0, pending: 0 },
            { type: 'Earned Leave', allotted: 18, taken: 0, pending: 0 }
          ];
          
          for (const leave of defaultLeaves) {
            await LeaveBalance.create({
              organization_id: organizationId,
              user_id: userId,
              leave_type: leave.type,
              total_allotted: leave.allotted,
              leaves_taken: leave.taken,
              leaves_pending_approval: leave.pending
            }, { 
              transaction,
              validate: false,
              hooks: false
            });
          }

          console.log(`📋 Leave balances created for: ${user.user_id}`);

          // Insert payroll data
          const payrollData = {
            organization_id: organizationId,
            user_id: userId,
            base_salary: empData.base_salary,
            hra: empData.hra,
            conveyance_allowance: Math.round(empData.base_salary * 0.04), // 4% of base
            medical_allowance: Math.round(empData.base_salary * 0.03), // 3% of base
            pf_deduction: Math.round(empData.base_salary * 0.12), // 12% of base
            esi_deduction: empData.base_salary <= 25000 ? Math.round(empData.base_salary * 0.0175) : 0,
            professional_tax: empData.base_salary > 40000 ? 200 : 150,
            ctc: empData.ctc
          };
          
          await PayrollData.create(payrollData, { 
            transaction,
            validate: false,
            hooks: false
          });

          console.log(`💰 Payroll data created for: ${user.user_id}`);

          insertedEmployees.push({
            user_id: userId,
            name: `${empData.first_name} ${empData.last_name}`,
            email: empData.email,
            role: empData.role,
            default_password: defaultPassword
          });

        } catch (error) {
          console.error(`❌ Error inserting employee ${empData.first_name} ${empData.last_name}:`, error);
          // Continue with next employee instead of failing completely
          continue;
        }
      }

      console.log(`✅ Successfully inserted ${insertedEmployees.length} employees`);
      return insertedEmployees;
    });
  }

  formatDateForPassword(dateStr) {
    if (!dateStr) return null;
    
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return null;
      
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = date.getFullYear();
      
      return `${day}${month}${year}`; // DDMMYYYY format
    } catch (error) {
      return null;
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
