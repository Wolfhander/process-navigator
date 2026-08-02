namespace ProcessNavigator.Api.Models;

public sealed record UserProfileModel(
    string Id,
    string DisplayName,
    string Role,
    string RoleName,
    IReadOnlyList<string> Permissions,
    bool IsActive = true);

public sealed record SessionModel(
    UserProfileModel CurrentUser,
    IReadOnlyList<UserProfileModel> AvailableUsers);

public sealed record RoleProfileModel(
    string Id,
    string Name,
    IReadOnlyList<string> Permissions);

public sealed record UserDirectoryModel(
    IReadOnlyList<UserProfileModel> Users,
    IReadOnlyList<RoleProfileModel> Roles);

public sealed record UserUpdateModel(
    string DisplayName,
    string Role,
    bool IsActive);

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
