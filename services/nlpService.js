import { NlpManager } from 'node-nlp';
import natural from 'natural';
import compromise from 'compromise';
import ModelClient, { isUnexpected } from "@azure-rest/ai-inference";
import { AzureKeyCredential } from "@azure/core-auth";
import { Op, QueryTypes } from 'sequelize';
import {
  User,
  LeaveBalance,
  CompanyPolicy,
  PayrollData,
  Organization,
  ChatLog,
  sequelize
} from '../models/index.js';

class EnhancedVipraNLPService {
  constructor() {
    this.manager = new NlpManager({
      languages: ['en'],
      forceNER: true,
      nlu: { log: false }
    });
    
    this.stemmer = natural.PorterStemmer;
    this.initialized = false;
    this.confidenceThreshold = 0.6; // Lower threshold for more LLM usage
    
    // Initialize LLM client
    this.llmClient = ModelClient(
      process.env.LLM_ENDPOINT,
      new AzureKeyCredential(process.env.GITHUB_TOKEN)
    );
    
    this.initializeNLP();
  }

  async initializeNLP() {
    try {
      await this.trainComprehensiveIntents();
      await this.addAdvancedEntities();
      await this.manager.train();
      this.initialized = true;
      console.log('Enhanced VipraCo NLP Service initialized with comprehensive training');
    } catch (error) {
      console.error('Enhanced NLP initialization error:', error);
    }
  }

  async trainComprehensiveIntents() {
    // Personal Information - Expanded
    const personalQueries = [
      // Employee ID variations
      { text: 'what is my employee id', intent: 'personal.employee_id' },
      { text: 'my employee number', intent: 'personal.employee_id' },
      { text: 'employee code', intent: 'personal.employee_id' },
      { text: 'staff id', intent: 'personal.employee_id' },
      { text: 'user identification', intent: 'personal.employee_id' },
      //salary
      
      // Role variations
      { text: 'what is my role', intent: 'personal.role' },
      { text: 'my designation', intent: 'personal.role' },
      { text: 'job title', intent: 'personal.role' },
      { text: 'position', intent: 'personal.role' },
      { text: 'current role', intent: 'personal.role' },
      
      // Manager variations
      { text: 'who is my manager', intent: 'personal.manager' },
      { text: 'my boss', intent: 'personal.manager' },
      { text: 'reporting manager', intent: 'personal.manager' },
      { text: 'supervisor', intent: 'personal.manager' },
      { text: 'team lead', intent: 'personal.manager' },
      
      // Department variations
      { text: 'which department', intent: 'personal.department' },
      { text: 'my team', intent: 'personal.department' },
      { text: 'department name', intent: 'personal.department' },
      { text: 'which division', intent: 'personal.department' },
      
      // Email variations
      { text: 'official email', intent: 'personal.email' },
      { text: 'work email', intent: 'personal.email' },
      { text: 'company email', intent: 'personal.email' },
      
      // Joining date variations
      { text: 'when did I join', intent: 'personal.joining_date' },
      { text: 'joining date', intent: 'personal.joining_date' },
      { text: 'start date', intent: 'personal.joining_date' },
      { text: 'employment start', intent: 'personal.joining_date' },
    ];

    // Leave Management - Comprehensive
    const leaveQueries = [
      // Casual leave
      { text: 'casual leave balance', intent: 'leave.balance.casual' },
      { text: 'how many casual leaves', intent: 'leave.balance.casual' },
      { text: 'CL balance', intent: 'leave.balance.casual' },
      { text: 'casual leaves remaining', intent: 'leave.balance.casual' },
      { text: 'casual leaves left', intent: 'leave.balance.casual' },
      
      // Sick leave
      { text: 'sick leave balance', intent: 'leave.balance.sick' },
      { text: 'SL balance', intent: 'leave.balance.sick' },
      { text: 'medical leave', intent: 'leave.balance.sick' },
      { text: 'sick leaves remaining', intent: 'leave.balance.sick' },
      
      // Earned leave
      { text: 'earned leave balance', intent: 'leave.balance.earned' },
      { text: 'EL balance', intent: 'leave.balance.earned' },
      { text: 'annual leave', intent: 'leave.balance.earned' },
      { text: 'vacation leave', intent: 'leave.balance.earned' },
      
      // Leave taken
      { text: 'leaves taken this year', intent: 'leave.taken.all' },
      { text: 'casual leaves used', intent: 'leave.taken.casual' },
      { text: 'sick leaves consumed', intent: 'leave.taken.sick' },
      { text: 'leaves consumed', intent: 'leave.taken.all' },
      
      // Pending leaves
      { text: 'pending leaves', intent: 'leave.pending' },
      { text: 'leave requests pending', intent: 'leave.pending' },
      { text: 'awaiting approval', intent: 'leave.pending' },
      
      // Complete summary
      { text: 'leave summary', intent: 'leave.summary' },
      { text: 'all leave details', intent: 'leave.summary' },
      { text: 'leave status', intent: 'leave.summary' },
    ];

    // Payroll - COMPREHENSIVE SALARY QUERIES
    const payrollQueries = [
      // Base salary - all variations
      { text: 'my base salary', intent: 'payroll.base_salary' },
      { text: 'basic salary', intent: 'payroll.base_salary' },
      { text: 'monthly basic', intent: 'payroll.base_salary' },
      { text: 'monthly salary', intent: 'payroll.monthly_total' },
      { text: 'monthly pay', intent: 'payroll.monthly_total' },
      { text: 'monthly income', intent: 'payroll.monthly_total' },
      { text: 'monthly earning', intent: 'payroll.monthly_total' },
      { text: 'monthly gross', intent: 'payroll.monthly_total' },
      { text: 'monthly take home', intent: 'payroll.monthly_net' },
      { text: 'monthly net salary', intent: 'payroll.monthly_net' },
      { text: 'monthly in hand', intent: 'payroll.monthly_net' },
      
      // Annual salary
      { text: 'annual salary', intent: 'payroll.ctc' },
      { text: 'yearly salary', intent: 'payroll.ctc' },
      { text: 'my ctc', intent: 'payroll.ctc' },
      { text: 'cost to company', intent: 'payroll.ctc' },
      { text: 'total package', intent: 'payroll.ctc' },
      
      // Allowances
      { text: 'hra amount', intent: 'payroll.hra' },
      { text: 'house rent allowance', intent: 'payroll.hra' },
      { text: 'conveyance allowance', intent: 'payroll.conveyance' },
      { text: 'travel allowance', intent: 'payroll.conveyance' },
      { text: 'medical allowance', intent: 'payroll.medical' },
      { text: 'health allowance', intent: 'payroll.medical' },
      
      // Deductions
      { text: 'pf deduction', intent: 'payroll.pf' },
      { text: 'provident fund', intent: 'payroll.pf' },
      { text: 'esi deduction', intent: 'payroll.esi' },
      { text: 'professional tax', intent: 'payroll.professional_tax' },
      { text: 'tax deduction', intent: 'payroll.deductions' },
      { text: 'total deductions', intent: 'payroll.deductions' },
      
      // Complete breakdown
      { text: 'salary breakdown', intent: 'payroll.breakdown' },
      { text: 'salary structure', intent: 'payroll.breakdown' },
      { text: 'pay slip details', intent: 'payroll.breakdown' },
      { text: 'complete salary', intent: 'payroll.breakdown' },
    ];

    // Company Policy - Expanded
    const policyQueries = [
      { text: 'work from home policy', intent: 'policy.wfh' },
      { text: 'wfh rules', intent: 'policy.wfh' },
      { text: 'remote work', intent: 'policy.wfh' },
      { text: 'travel policy', intent: 'policy.travel' },
      { text: 'expense policy', intent: 'policy.travel' },
      { text: 'company holidays', intent: 'policy.holidays' },
      { text: 'public holidays', intent: 'policy.holidays' },
      { text: 'attendance policy', intent: 'policy.attendance' },
      { text: 'safety rules', intent: 'policy.safety' },
      { text: 'hr policies', intent: 'policy.general' },
    ];
     const salaryQueries = [
    { text: 'what is my salary', intent: 'payroll.salary_general' },
    { text: 'my salary', intent: 'payroll.salary_general' },
    { text: 'salary details', intent: 'payroll.salary_general' },
    { text: 'how much do I earn', intent: 'payroll.salary_general' },
    { text: 'what do I get paid', intent: 'payroll.salary_general' },
    { text: 'my pay', intent: 'payroll.salary_general' },
    { text: 'tell me my salary', intent: 'payroll.salary_general' },
  ];

    // Add all queries to NLP manager
    [...personalQueries,...salaryQueries ,...leaveQueries, ...payrollQueries, ...policyQueries].forEach(({ text, intent }) => {
      this.manager.addDocument('en', text, intent);
    });
  }

  async addAdvancedEntities() {
    // Leave types
    this.manager.addNamedEntityText('leave_type', 'casual', ['en'], ['casual', 'cl', 'casual leave']);
    this.manager.addNamedEntityText('leave_type', 'sick', ['en'], ['sick', 'sl', 'sick leave', 'medical']);
    this.manager.addNamedEntityText('leave_type', 'earned', ['en'], ['earned', 'el', 'earned leave', 'annual', 'vacation']);
    
    // Salary terms
    this.manager.addNamedEntityText('salary_term', 'monthly', ['en'], ['monthly', 'month', 'per month']);
    this.manager.addNamedEntityText('salary_term', 'annual', ['en'], ['annual', 'yearly', 'year', 'per year']);
    
    // Numbers and amounts
    this.manager.addRegexEntity('amount', 'en', /\d+(?:,\d{3})*(?:\.\d{2})?/g);
    this.manager.addRegexEntity('percentage', 'en', /\d+(?:\.\d+)?%/g);
  }

  async processQuery(query, userId, organizationId) {
    const startTime = Date.now();
    
    try {
      if (!this.initialized) {
        await this.initializeNLP();
      }

      const processedQuery = this.preprocessQuery(query);
      const nlpResult = await this.manager.process('en', processedQuery);
      
      let response;
      
      // Enhanced confidence check - use LLM for complex or low confidence queries
      if (!nlpResult.intent || nlpResult.intent === 'None' || nlpResult.score < this.confidenceThreshold) {
        // Use intelligent LLM fallback with database access
        response = await this.handleIntelligentLLMFallback(query, userId, organizationId);
        response.response_source = 'llm_database';
      } else {
        // Handle with enhanced NLP
        response = await this.handleEnhancedIntent(nlpResult, userId, organizationId);
        response.response_source = 'nlp_enhanced';
        response.confidence = nlpResult.score;
        response.intent = nlpResult.intent;
      }

      // Log the interaction
      await this.logChatInteraction(
        organizationId,
        userId,
        query,
        response.answer,
        response.intent || 'llm_generated',
        response.confidence || 0,
        response.response_source,
        Date.now() - startTime
      );

      return response;
    } catch (error) {
      console.error('Enhanced NLP Processing Error:', error);
      return {
        success: false,
        answer: "I apologize, but I encountered an error processing your request. Please try again or contact your HR team for assistance.",
        confidence: 0,
        response_source: 'fallback',
        error: error.message
      };
    }
  }

 async handleIntelligentLLMFallback(query, userId, organizationId) {
  try {
    // Get comprehensive user and database context
    const context = await this.getComprehensiveContext(userId, organizationId);
    
    // Calculate monthly values for quick reference
    const monthlyGross = parseFloat(context.payroll?.base_salary || 0) + 
                        parseFloat(context.payroll?.hra || 0) + 
                        parseFloat(context.payroll?.conveyance_allowance || 0) + 
                        parseFloat(context.payroll?.medical_allowance || 0);
    
    const totalDeductions = parseFloat(context.payroll?.pf_deduction || 0) + 
                           parseFloat(context.payroll?.esi_deduction || 0) + 
                           parseFloat(context.payroll?.professional_tax || 0);
    
    const monthlyNet = monthlyGross - totalDeductions;
    
    const systemPrompt = `You are VipraCo, a concise HR chatbot. Give SHORT answers (max 2 sentences). You are a CHATBOT - be friendly but brief.

EMPLOYEE: ${context.user.first_name} ${context.user.last_name}
MONTHLY SALARY: ₹${monthlyNet.toLocaleString('en-IN')} (net), ₹${monthlyGross.toLocaleString('en-IN')} (gross)
ANNUAL CTC: ₹${context.payroll?.ctc || 'N/A'}
LEAVE BALANCES: ${context.leaveBalances.map(l => `${l.leave_type}: ${l.total_allotted - l.leaves_taken - l.leaves_pending_approval}`).join(', ')}

RESPONSE RULES:
- Maximum 2 sentences
- Use Indian Rupee formatting
- For salary: mention both monthly net and annual CTC
- Be conversational but precise

Answer briefly:`;

    const response = await this.llmClient.path("/chat/completions").post({
      body: {
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: query }
        ],
        temperature: 0.3,
        top_p: 0.9,
        model: process.env.LLM_MODEL,
        max_tokens: 150
      }
    });

    if (isUnexpected(response)) {
      throw new Error(response.body.error);
    }

    const answer = response.body.choices[0].message.content;

    // If LLM couldn't answer with provided context, try database query generation
    if (answer.toLowerCase().includes('cannot') || answer.toLowerCase().includes("don't have")) {
      return await this.handleDatabaseQueryGeneration(query, userId, organizationId);
    }

    return {
      success: true,
      answer: answer,
      confidence: 0.9
    };
  } catch (error) {
    console.error('Intelligent LLM Fallback Error:', error);
    return await this.handleDatabaseQueryGeneration(query, userId, organizationId);
  }
}


  async handleDatabaseQueryGeneration(query, userId, organizationId) {
    try {
      const systemPrompt = `You are a SQL expert for an HR system. Generate a safe SQL query to answer the user's question.

DATABASE SCHEMA:
- users (user_id, organization_id, first_name, last_name, email, role, manager_id, date_of_joining, department, location)
- payroll_data (user_id, organization_id, base_salary, hra, conveyance_allowance, medical_allowance, pf_deduction, esi_deduction, professional_tax, ctc)
- leave_balances (user_id, organization_id, leave_type, total_allotted, leaves_taken, leaves_pending_approval)
- company_policies (organization_id, policy_title, policy_category, policy_content, keywords)

RULES:
1. Always include WHERE organization_id = '${organizationId}' for security
2. For the current user, add WHERE user_id = '${userId}'
3. Only use SELECT statements, no INSERT/UPDATE/DELETE
4. Use proper JOINs when needed
5. Return only the SQL query, nothing else

User question: ${query}

Generate SQL:`;

      const response = await this.llmClient.path("/chat/completions").post({
        body: {
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: "Generate SQL query only" }
          ],
          temperature: 0.1,
          top_p: 0.9,
          model: process.env.LLM_MODEL,
          max_tokens: 300
        }
      });

      if (isUnexpected(response)) {
        throw new Error(response.body.error);
      }

      let sqlQuery = response.body.choices[0].message.content.trim();
      
      // Clean and validate SQL
      sqlQuery = sqlQuery.replace(/``````/g, '').trim();
      
      // Security check
      if (!this.isValidQuery(sqlQuery, organizationId)) {
        throw new Error('Generated query failed security validation');
      }

      // Execute the query
      const results = await sequelize.query(sqlQuery, {
        type: QueryTypes.SELECT,
        raw: true
      });

      // Generate natural language response from results
      return await this.generateResponseFromResults(query, results, sqlQuery);

    } catch (error) {
      console.error('Database Query Generation Error:', error);
      return {
        success: false,
        answer: "I'm unable to process that query at the moment. Please try rephrasing your question or contact HR for assistance.",
        confidence: 0
      };
    }
  }

  isValidQuery(query, organizationId) {
    const lowerQuery = query.toLowerCase();
    
    // Must be SELECT only
    if (!lowerQuery.startsWith('select')) {
      return false;
    }
    
    // Must not contain dangerous keywords
    const dangerousKeywords = ['drop', 'delete', 'insert', 'update', 'alter', 'create', 'truncate'];
    if (dangerousKeywords.some(keyword => lowerQuery.includes(keyword))) {
      return false;
    }
    
    // Must include organization filter for multi-tenancy
    if (!lowerQuery.includes(organizationId.toLowerCase())) {
      return false;
    }
    
    return true;
  }

 async generateResponseFromResults(query, results, sqlQuery) {
  try {
    const systemPrompt = `Convert SQL results to SHORT chat response (max 2 sentences).

Question: ${query}
Results: ${JSON.stringify(results, null, 2)}

Rules:
- Maximum 2 sentences
- Use ₹ for money
- Be conversational
- You are a chatbot

Brief response:`;

    const response = await this.llmClient.path("/chat/completions").post({
      body: {
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: "Give concise response" }
        ],
        temperature: 0.3,
        top_p: 0.9,
        model: process.env.LLM_MODEL,
        max_tokens: 100
      }
    });

    if (isUnexpected(response)) {
      throw new Error(response.body.error);
    }

    return {
      success: true,
      answer: response.body.choices[0].message.content,
      confidence: 0.85,
      data: results
    };
  } catch (error) {
    // Fallback to simple result formatting
    if (results.length === 0) {
      return {
        success: true,
        answer: "No results found.",
        confidence: 0.7
      };
    }

    // Simple formatting for salary data
    if (results[0].base_salary) {
      const result = results[0];
      const monthlyGross = parseFloat(result.base_salary) + parseFloat(result.hra || 0);
      const monthlyNet = monthlyGross - parseFloat(result.pf_deduction || 0) - parseFloat(result.esi_deduction || 0) - parseFloat(result.professional_tax || 0);
      return {
        success: true,
        answer: `Your monthly salary is ₹${monthlyNet.toLocaleString('en-IN')} and annual CTC is ₹${parseFloat(result.ctc).toLocaleString('en-IN')}.`,
        confidence: 0.7,
        data: results
      };
    }

    return {
      success: true,
      answer: `Found: ${Object.entries(results[0]).map(([k,v]) => `${k}: ${v}`).slice(0,2).join(', ')}`,
      confidence: 0.7,
      data: results
    };
  }
}


  async getComprehensiveContext(userId, organizationId) {
    const user = await User.findOne({
      where: { user_id: userId, organization_id: organizationId },
      include: [
        {
          model: Organization,
          as: 'organization',
          attributes: ['org_name', 'subscription_plan']
        },
        {
          model: User,
          as: 'manager',
          attributes: ['first_name', 'last_name', 'email']
        }
      ]
    });

    const payroll = await PayrollData.findOne({
      where: { user_id: userId, organization_id: organizationId }
    });

    const leaveBalances = await LeaveBalance.findAll({
      where: { user_id: userId, organization_id: organizationId }
    });

    return {
      user,
      organization: user?.organization,
      manager: user?.manager,
      payroll,
      leaveBalances
    };
  }

  async handleEnhancedIntent(nlpResult, userId, organizationId) {
    const { intent, entities } = nlpResult;

    try {
      if (intent.startsWith('personal.')) {
        return await this.handlePersonalInfoIntent(intent, userId, organizationId);
      } else if (intent.startsWith('leave.')) {
        return await this.handleLeaveIntent(intent, userId, organizationId, entities);
      } else if (intent.startsWith('policy.')) {
        return await this.handlePolicyIntent(intent, userId, organizationId, entities);
      } else if (intent.startsWith('payroll.')) {
        return await this.handleEnhancedPayrollIntent(intent, userId, organizationId);
      }

      return this.handleUnknownQuery(nlpResult.utterance);
    } catch (error) {
      console.error(`Enhanced intent handling error for ${intent}:`, error);
      return {
        success: false,
        answer: "I encountered an error while processing your request. Please try again.",
        confidence: nlpResult.score
      };
    }
  }

async handleEnhancedPayrollIntent(intent, userId, organizationId) {
  try {
    const payrollData = await PayrollData.findOne({
      where: { user_id: userId, organization_id: organizationId }
    });

    if (!payrollData) {
      return { success: false, answer: "No payroll information found." };
    }

    // Calculate derived values
    const monthlyGross = parseFloat(payrollData.base_salary) + 
                        parseFloat(payrollData.hra || 0) + 
                        parseFloat(payrollData.conveyance_allowance || 0) + 
                        parseFloat(payrollData.medical_allowance || 0);
    
    const totalDeductions = parseFloat(payrollData.pf_deduction || 0) + 
                           parseFloat(payrollData.esi_deduction || 0) + 
                           parseFloat(payrollData.professional_tax || 0);
    
    const monthlyNet = monthlyGross - totalDeductions;

    let answer = "";
    
    switch (intent) {
      case 'payroll.base_salary':
        answer = `Your base salary is ₹${payrollData.base_salary.toLocaleString('en-IN')}/month.`;
        break;
        
      case 'payroll.monthly_total':
        answer = `Your monthly gross salary is ₹${monthlyGross.toLocaleString('en-IN')}.`;
        break;
        
      case 'payroll.monthly_net':
        answer = `Your monthly take-home is ₹${monthlyNet.toLocaleString('en-IN')}.`;
        break;
        
      case 'payroll.ctc':
        answer = `Your annual CTC is ₹${payrollData.ctc.toLocaleString('en-IN')}.`;
        break;
        
      case 'payroll.salary_general':
        answer = `Your monthly salary is ₹${monthlyNet.toLocaleString('en-IN')} (net) and annual CTC is ₹${payrollData.ctc.toLocaleString('en-IN')}.`;
        break;
        
      case 'payroll.breakdown':
        answer = `Monthly: ₹${monthlyNet.toLocaleString('en-IN')} net (₹${monthlyGross.toLocaleString('en-IN')} gross - ₹${totalDeductions.toLocaleString('en-IN')} deductions). Annual CTC: ₹${payrollData.ctc.toLocaleString('en-IN')}.`;
        break;
        
      default:
        answer = `Your monthly salary is ₹${monthlyNet.toLocaleString('en-IN')} and annual CTC is ₹${payrollData.ctc.toLocaleString('en-IN')}.`;
    }

    return { success: true, answer, data: payrollData };
  } catch (error) {
    console.error('Enhanced payroll intent error:', error);
    return { success: false, answer: "Error retrieving salary information." };
  }
}


  // Reuse existing methods with improvements
  async handlePersonalInfoIntent(intent, userId, organizationId) {
    try {
      const user = await User.findOne({
        where: { user_id: userId, organization_id: organizationId },
        include: [{
          model: User,
          as: 'manager',
          attributes: ['first_name', 'last_name', 'email']
        }]
      });

      if (!user) {
        return { success: false, answer: "User information not found." };
      }

      let answer = "";
      switch (intent) {
        case 'personal.employee_id':
          answer = `Your employee ID is: ${user.user_id}`;
          break;
        case 'personal.role':
          answer = `Your current role is: ${user.role}`;
          break;
        case 'personal.manager':
          if (user.manager) {
            answer = `Your manager is: ${user.manager.first_name} ${user.manager.last_name} (${user.manager.email})`;
          } else {
            answer = "You don't have a manager assigned in the system.";
          }
          break;
        case 'personal.email':
          answer = `Your official email address is: ${user.email}`;
          break;
        case 'personal.joining_date':
          const joinDate = new Date(user.date_of_joining).toLocaleDateString('en-IN');
          answer = `You joined the company on: ${joinDate}`;
          break;
        case 'personal.department':
          answer = `You are in the ${user.department} department, located in ${user.location}`;
          break;
        default:
          answer = "I couldn't find the specific personal information you're looking for.";
      }

      return { success: true, answer, data: user };
    } catch (error) {
      console.error('Personal info intent error:', error);
      return { success: false, answer: "Error retrieving personal information." };
    }
  }

  async handleLeaveIntent(intent, userId, organizationId, entities) {
    try {
      const leaveBalances = await LeaveBalance.findAll({
        where: { user_id: userId, organization_id: organizationId }
      });

      if (!leaveBalances.length) {
        return { success: false, answer: "No leave information found for your account." };
      }

      let answer = "";
      switch (intent) {
        case 'leave.balance.casual':
          const casualLeave = leaveBalances.find(l => l.leave_type === 'Casual Leave');
          if (casualLeave) {
            const remaining = casualLeave.total_allotted - casualLeave.leaves_taken - casualLeave.leaves_pending_approval;
            answer = `You have ${remaining} casual leaves remaining out of ${casualLeave.total_allotted} allotted.`;
          } else {
            answer = "No casual leave information found.";
          }
          break;
          
        case 'leave.balance.sick':
          const sickLeave = leaveBalances.find(l => l.leave_type === 'Sick Leave');
          if (sickLeave) {
            const remaining = sickLeave.total_allotted - sickLeave.leaves_taken - sickLeave.leaves_pending_approval;
            answer = `You have ${remaining} sick leaves remaining out of ${sickLeave.total_allotted} allotted.`;
          } else {
            answer = "No sick leave information found.";
          }
          break;
          
        case 'leave.balance.earned':
          const earnedLeave = leaveBalances.find(l => l.leave_type === 'Earned Leave');
          if (earnedLeave) {
            const remaining = earnedLeave.total_allotted - earnedLeave.leaves_taken - earnedLeave.leaves_pending_approval;
            answer = `You have ${remaining} earned leaves remaining out of ${earnedLeave.total_allotted} allotted.`;
          } else {
            answer = "No earned leave information found.";
          }
          break;
          
        case 'leave.pending':
          const pendingLeaves = leaveBalances.reduce((sum, leave) => sum + leave.leaves_pending_approval, 0);
          answer = `You have ${pendingLeaves} leaves pending approval.`;
          break;
          
        case 'leave.balance.all':
        case 'leave.summary':
          answer = "Here's your complete leave summary:\n";
          leaveBalances.forEach(leave => {
            const remaining = leave.total_allotted - leave.leaves_taken - leave.leaves_pending_approval;
            answer += `\n• ${leave.leave_type}: ${remaining}/${leave.total_allotted} remaining (${leave.leaves_taken} taken, ${leave.leaves_pending_approval} pending)`;
          });
          break;
          
        default:
          answer = "I couldn't find the specific leave information you're looking for.";
      }

      return { success: true, answer, data: leaveBalances };
    } catch (error) {
      console.error('Leave intent error:', error);
      return { success: false, answer: "Error retrieving leave information." };
    }
  }

  async handlePolicyIntent(intent, userId, organizationId, entities) {
    try {
      let whereClause = { organization_id: organizationId, is_active: true };

      switch (intent) {
        case 'policy.wfh':
          whereClause.keywords = { [Op.like]: '%WFH%' };
          break;
        case 'policy.travel':
          whereClause.keywords = { [Op.like]: '%travel%' };
          break;
        case 'policy.holidays':
          whereClause.keywords = { [Op.like]: '%holiday%' };
          break;
        case 'policy.attendance':
          whereClause.keywords = { [Op.like]: '%attendance%' };
          break;
        case 'policy.safety':
          whereClause.keywords = { [Op.like]: '%safety%' };
          break;
      }

      const policies = await CompanyPolicy.findAll({
        where: whereClause,
        order: [['last_reviewed', 'DESC']]
      });

      if (!policies.length) {
        return {
          success: false,
          answer: "No relevant policies found for your organization."
        };
      }

      let answer = "";
      if (policies.length === 1) {
        const policy = policies[0];
        answer = `**${policy.policy_title}**\n\n${policy.policy_content}`;
      } else {
        answer = "Here are the relevant policies I found:\n\n";
        policies.forEach((policy, index) => {
          answer += `**${index + 1}. ${policy.policy_title}**\n${policy.policy_content}\n\n`;
        });
      }

      return { success: true, answer, data: policies };
    } catch (error) {
      console.error('Policy intent error:', error);
      return { success: false, answer: "Error retrieving policy information." };
    }
  }

  preprocessQuery(query) {
    let processed = query.toLowerCase().trim();
    
    processed = processed
      .replace(/\b(emp|employee)\s+(id|number)\b/g, 'employee id')
      .replace(/\b(mgr|manager)\b/g, 'manager')
      .replace(/\bwfh\b/g, 'work from home')
      .replace(/\bhow much\b/g, 'what is')
      .replace(/\btell me\b/g, 'what is')
      .replace(/\bmonthly pay\b/g, 'monthly salary')
      .replace(/\bmonthly income\b/g, 'monthly salary')
      .replace(/\bmonthly earning\b/g, 'monthly salary')
      .replace(/\bnet salary\b/g, 'monthly net salary')
      .replace(/\btake home\b/g, 'monthly net salary')
      .replace(/\bin hand\b/g, 'monthly net salary');

    return processed;
  }

  handleUnknownQuery(query) {
    const suggestions = [
      "Ask about your salary: 'What is my monthly salary?'",
      "Check leave balance: 'How many casual leaves do I have?'",
      "Get personal info: 'What is my employee ID?'",
      "Check company policies: 'What is the work from home policy?'",
      "Ask about deductions: 'What are my total deductions?'"
    ];

    return {
      success: false,
      answer: `I'm sorry, I couldn't understand your question: "${query}"\n\nHere are some things you can ask me:\n\n• ${suggestions.join('\n• ')}`,
      confidence: 0,
      suggestions
    };
  }

  async logChatInteraction(organizationId, userId, query, response, intent, confidence, responseSource, responseTime) {
    try {
      await ChatLog.create({
        organization_id: organizationId,
        user_id: userId,
        query,
        response,
        intent,
        confidence,
        response_source: responseSource,
        response_time_ms: responseTime
      });
    } catch (error) {
      console.error('Error logging chat interaction:', error);
    }
  }

  getStatus() {
    return {
      initialized: this.initialized,
      confidenceThreshold: this.confidenceThreshold,
      features: [
        'Enhanced NLP with comprehensive training',
        'Intelligent LLM fallback with database context',
        'Dynamic SQL query generation',
        'Advanced salary calculations',
        'Multi-table complex queries',
        'Comprehensive intent recognition'
      ]
    };
  }
}

export default new EnhancedVipraNLPService();
