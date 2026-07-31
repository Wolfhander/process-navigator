namespace ProcessNavigator.Api.Models;

public sealed record UserProfileModel(
    string Id,
    string DisplayName,
    string Role,
    string RoleName,
    IReadOnlyList<string> Permissions);

public sealed record SessionModel(
    UserProfileModel CurrentUser,
    IReadOnlyList<UserProfileModel> AvailableUsers);

public static class ProcessPermissions
{
    public const string View = "process.view";
    public const string Execute = "process.execute";
    public const string Import = "process.import";
    public const string CreateDraft = "process.draft.create";
    public const string EditDiagram = "process.diagram.edit";
    public const string EditContext = "process.context.edit";
    public const string Publish = "process.publish";
    public const string ViewAnalytics = "analytics.view";
    public const string ManageUsers = "users.manage";
    public const string ManageSystem = "system.manage";
}
