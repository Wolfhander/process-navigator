namespace ProcessNavigator.Api.Models;

public sealed record StepExecutionModel(string ElementId, string Status, DateTimeOffset? StartedAt, DateTimeOffset? CompletedAt, string? UserId);
public sealed record ProcessInstanceModel(string Id, string ProcessId, string ProcessVersion, string Name, string Status,
    DateTimeOffset StartedAt, DateTimeOffset? CompletedAt, string StartedBy, IReadOnlyList<StepExecutionModel> Steps);
public sealed record StartProcessInstanceModel(string? Name);
public sealed record StepStatusUpdateModel(string Status);
public sealed record StepAnalyticsModel(string ElementId, string Name, string LaneName, string? Norm,
    int CompletedCount, int InProgressCount, double? AverageMinutes, double? MaximumMinutes, int OverdueCount);
public sealed record ProcessAnalyticsModel(string ProcessId, int TotalInstances, int ActiveInstances, int CompletedInstances,
    double? AverageCycleMinutes, IReadOnlyList<StepAnalyticsModel> Steps);
