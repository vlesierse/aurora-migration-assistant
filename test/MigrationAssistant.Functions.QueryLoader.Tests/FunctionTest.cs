
namespace MigrationAssistant.Functions.QueryLoader.Tests;

public class FunctionTest
{
    [Fact]
    public async Task TestFunction()
    {
        var function = new Function(new FunctionOptions());
        await function.FunctionHandler(
            new QueryLoaderEvent {
                S3ObjectBucketName = "amaencore-artifacts82dd59a1-xcbm4x75xg8s",
                S3ObjectKey = "ReadTrace_0_133070265302890000.xel"
                }
            , new TestLambdaContext());
    }
}