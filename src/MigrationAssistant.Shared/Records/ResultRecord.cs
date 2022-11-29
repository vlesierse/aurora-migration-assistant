namespace MigrationAssistant.Shared.Records;

public class ResultRecord : QueryRecord
{
    public bool Success { get; set; }
    public string ErrorMessage { get; set; }
    public DateTime ExecutionTime { get; set; }
    public int Duraction { get; set; }
}
