# Amazon Aurora Migration Assistant

## Getting Started

### Prerequisites
- AWS CDK

### Preparations
```sh
git clone https://
cd aurora-migration-assistant
npm install
```

### Deploy Migration Stack
```sh
cdk deploy AuroraMigrationAssistant-Migration
```

### Deploy Test Bench
```sh
cdk deploy AuroraMigrationAssistant-TestBench
```

### Deployment Options

- **stack-name** - Provide a custom stack name for supporting multiple stacks in a single AWS Account.
- **vpc** - Deploy all resources in a VPC which already exists instead of creating a new one.
- **snapshot** - Restore a SQL Server Instance from a snapshot.
- **instance-type** - Instance type of the SQL Server Instance. *Default: r6i.large*
- **disable-bastion** - Skip the creation of a bastion instance for connecting to the databases using SSM Session Manager.