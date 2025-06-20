import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

// Organization Model
const Organization = sequelize.define('Organization', {
  organization_id: {
    type: DataTypes.STRING(50),
    primaryKey: true,
  },
  org_name: {
    type: DataTypes.STRING(255),
    allowNull: false,
  },
  subscription_plan: {
    type: DataTypes.ENUM('starter', 'pro', 'enterprise'),
    defaultValue: 'starter',
  },
  max_users: {
    type: DataTypes.INTEGER,
    defaultValue: 50,
  },
  admin_email: {
    type: DataTypes.STRING(255),
    allowNull: false,
    unique: true,
  },
  admin_password: {
    type: DataTypes.STRING(255),
    allowNull: false,
  },
  contact_phone: {
    type: DataTypes.STRING(20),
  },
  address: {
    type: DataTypes.TEXT,
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
}, {
  tableName: 'organizations',
  timestamps: true,
});

// User Model
const User = sequelize.define('User', {
  user_id: {
    type: DataTypes.STRING(50),
    primaryKey: true,
  },
  organization_id: {
    type: DataTypes.STRING(50),
    allowNull: false,
    references: {
      model: Organization,
      key: 'organization_id',
    },
  },
  first_name: {
    type: DataTypes.STRING(100),
    allowNull: false,
  },
  last_name: {
    type: DataTypes.STRING(100),
    allowNull: false,
  },
  email: {
    type: DataTypes.STRING(255),
    allowNull: false,
    unique: true,
    validate: {
      isEmail: true,
    },
  },
  password_hash: {
    type: DataTypes.STRING(255),
    allowNull: false,
  },
  role: {
    type: DataTypes.ENUM('Employee', 'Manager', 'Admin'),
    defaultValue: 'Employee',
  },
  manager_id: {
    type: DataTypes.STRING(50),
    references: {
      model: 'users',
      key: 'user_id',
    },
  },
  date_of_joining: {
    type: DataTypes.DATEONLY,
    allowNull: false,
  },
  date_of_birth: {
    type: DataTypes.DATEONLY,
    allowNull: true,
  },
  department: {
    type: DataTypes.STRING(100),
  },
  location: {
    type: DataTypes.STRING(100),
  },
  phone: {
    type: DataTypes.STRING(20),
  },
  employee_number: {
    type: DataTypes.STRING(50),
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
  last_login: {
    type: DataTypes.DATE,
  },
  password_reset_required: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
}, {
  tableName: 'users',
  timestamps: true,
});

// Leave Balance Model
const LeaveBalance = sequelize.define('LeaveBalance', {
  balance_id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  organization_id: {
    type: DataTypes.STRING(50),
    allowNull: false,
    references: {
      model: Organization,
      key: 'organization_id',
    },
  },
  user_id: {
    type: DataTypes.STRING(50),
    allowNull: false,
    references: {
      model: User,
      key: 'user_id',
    },
  },
  leave_type: {
    type: DataTypes.STRING(50),
    allowNull: false,
  },
  total_allotted: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
  },
  leaves_taken: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
  },
  leaves_pending_approval: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
  },
  last_updated: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
}, {
  tableName: 'leave_balances',
  timestamps: true,
});

// Company Policy Model
const CompanyPolicy = sequelize.define('CompanyPolicy', {
  policy_id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  organization_id: {
    type: DataTypes.STRING(50),
    allowNull: false,
    references: {
      model: Organization,
      key: 'organization_id',
    },
  },
  policy_title: {
    type: DataTypes.STRING(255),
    allowNull: false,
  },
  policy_category: {
    type: DataTypes.STRING(100),
  },
  policy_content: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  last_reviewed: {
    type: DataTypes.DATEONLY,
  },
  keywords: {
    type: DataTypes.TEXT,
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
}, {
  tableName: 'company_policies',
  timestamps: true,
});

// Payroll Data Model
const PayrollData = sequelize.define('PayrollData', {
  payroll_id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  organization_id: {
    type: DataTypes.STRING(50),
    allowNull: false,
    references: {
      model: Organization,
      key: 'organization_id',
    },
  },
  user_id: {
    type: DataTypes.STRING(50),
    allowNull: false,
    references: {
      model: User,
      key: 'user_id',
    },
  },
  base_salary: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
  },
  hra: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0,
  },
  conveyance_allowance: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0,
  },
  medical_allowance: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0,
  },
  pf_deduction: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0,
  },
  esi_deduction: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0,
  },
  professional_tax: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0,
  },
  ctc: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
  },
}, {
  tableName: 'payroll_data',
  timestamps: true,
});

// Chat Log Model (for analytics)
const ChatLog = sequelize.define('ChatLog', {
  log_id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  organization_id: {
    type: DataTypes.STRING(50),
    allowNull: false,
  },
  user_id: {
    type: DataTypes.STRING(50),
    allowNull: false,
  },
  query: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  response: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  intent: {
    type: DataTypes.STRING(100),
  },
  confidence: {
    type: DataTypes.DECIMAL(3, 2),
  },
  response_source: {
    type: DataTypes.ENUM('nlp', 'llm', 'fallback'),
    allowNull: false,
  },
  response_time_ms: {
    type: DataTypes.INTEGER,
  },
}, {
  tableName: 'chat_logs',
  timestamps: true,
});

// Define Associations
Organization.hasMany(User, { foreignKey: 'organization_id', as: 'employees' });
User.belongsTo(Organization, { foreignKey: 'organization_id', as: 'organization' });

User.belongsTo(User, { foreignKey: 'manager_id', as: 'manager' });
User.hasMany(User, { foreignKey: 'manager_id', as: 'subordinates' });

Organization.hasMany(LeaveBalance, { foreignKey: 'organization_id' });
User.hasMany(LeaveBalance, { foreignKey: 'user_id', as: 'leaveBalances' });
LeaveBalance.belongsTo(User, { foreignKey: 'user_id', as: 'employee' });
LeaveBalance.belongsTo(Organization, { foreignKey: 'organization_id' });

Organization.hasMany(CompanyPolicy, { foreignKey: 'organization_id', as: 'policies' });
CompanyPolicy.belongsTo(Organization, { foreignKey: 'organization_id' });

Organization.hasMany(PayrollData, { foreignKey: 'organization_id' });
User.hasOne(PayrollData, { foreignKey: 'user_id', as: 'payroll' });
PayrollData.belongsTo(User, { foreignKey: 'user_id', as: 'employee' });
PayrollData.belongsTo(Organization, { foreignKey: 'organization_id' });

export {
  Organization,
  User,
  LeaveBalance,
  CompanyPolicy,
  PayrollData,
  ChatLog,
  sequelize
};
