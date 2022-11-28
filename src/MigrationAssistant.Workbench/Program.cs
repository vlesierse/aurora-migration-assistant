using Amazon.Lambda.TestUtilities;
using MigrationAssistant.Functions.QueryLoader;

var function = new Function();
await function.FunctionHandler(
    new QueryLoaderEvent { 
        S3ObjectKey = "ReadTrace_0_133070265302890000.xel",
        S3ObjectBucketName = "amaencore-artifacts82dd59a1-xcbm4x75xg8s"
    },
    new TestLambdaContext()
);