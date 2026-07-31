using ProcessNavigator.Api.Models;

namespace ProcessNavigator.Api.Services;

public sealed class AccessControlService
{
    public const string RoleHeader = "X-Process-Navigator-Role";
    private readonly IReadOnlyDictionary<string, UserProfileModel> users;

    public AccessControlService()
    {
        users = new[]
        {
            User("employee", "Мария Соколова", "Исполнитель", ProcessPermissions.View, ProcessPermissions.Execute),
            User("manager", "Алексей Воронцов", "Руководитель", ProcessPermissions.View, ProcessPermissions.Execute, ProcessPermissions.ViewAnalytics),
            User("analyst", "Елена Морозова", "Аналитик", ProcessPermissions.View, ProcessPermissions.Import, ProcessPermissions.CreateDraft, ProcessPermissions.EditDiagram, ProcessPermissions.EditContext),
            User("owner", "Игорь Белов", "Владелец процесса", ProcessPermissions.View, ProcessPermissions.CreateDraft, ProcessPermissions.EditContext, ProcessPermissions.Publish, ProcessPermissions.ViewAnalytics),
            User("administrator", "Ольга Крылова", "Администратор", ProcessPermissions.View, ProcessPermissions.Execute, ProcessPermissions.Import, ProcessPermissions.CreateDraft, ProcessPermissions.EditDiagram, ProcessPermissions.EditContext, ProcessPermissions.Publish, ProcessPermissions.ViewAnalytics, ProcessPermissions.ManageUsers),
            User("superadministrator", "Сергей Лавров", "СуперАдминистратор", ProcessPermissions.View, ProcessPermissions.Execute, ProcessPermissions.Import, ProcessPermissions.CreateDraft, ProcessPermissions.EditDiagram, ProcessPermissions.EditContext, ProcessPermissions.Publish, ProcessPermissions.ViewAnalytics, ProcessPermissions.ManageUsers, ProcessPermissions.ManageSystem)
        }.ToDictionary(user => user.Role, StringComparer.OrdinalIgnoreCase);
    }

    public SessionModel Session(HttpContext context)
    {
        var current = CurrentUser(context);
        return new SessionModel(current, users.Values.ToArray());
    }

    public UserProfileModel CurrentUser(HttpContext context)
    {
        var role = context.Request.Headers[RoleHeader].FirstOrDefault();
        return role is not null && users.TryGetValue(role, out var user)
            ? user
            : users["employee"];
    }

    public bool Has(HttpContext context, string permission) =>
        CurrentUser(context).Permissions.Contains(permission, StringComparer.Ordinal);

    private static UserProfileModel User(string role, string displayName, string roleName, params string[] permissions) =>
        new($"demo-{role}", displayName, role, roleName, permissions);
}
