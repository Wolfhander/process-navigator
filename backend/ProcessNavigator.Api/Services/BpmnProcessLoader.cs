using System.Globalization;
using System.Text.Json;
using System.Xml.Linq;
using ProcessNavigator.Api.Models;

namespace ProcessNavigator.Api.Services;

public sealed class BpmnProcessLoader(IWebHostEnvironment environment)
{
    private static readonly XNamespace Bpmn = "http://www.omg.org/spec/BPMN/20100524/MODEL";
    private static readonly XNamespace BpmnDi = "http://www.omg.org/spec/BPMN/20100524/DI";
    private static readonly XNamespace Dc = "http://www.omg.org/spec/DD/20100524/DC";
    private static readonly XNamespace Di = "http://www.omg.org/spec/DD/20100524/DI";

    private static readonly IReadOnlyDictionary<string, string> SupportedNodeTypes = new Dictionary<string, string>
    {
        ["task"] = "task",
        ["userTask"] = "task",
        ["manualTask"] = "task",
        ["serviceTask"] = "task",
        ["sendTask"] = "task",
        ["receiveTask"] = "task",
        ["businessRuleTask"] = "task",
        ["callActivity"] = "task",
        ["subProcess"] = "task",
        ["startEvent"] = "startEvent",
        ["endEvent"] = "endEvent",
        ["exclusiveGateway"] = "exclusiveGateway"
    };

    public string GetBpmnPath(string processId) => ResolvePath(processId, ".bpmn");

    public async Task<ProcessModel> LoadAsync(string processId, CancellationToken cancellationToken = default)
    {
        var bpmnPath = GetBpmnPath(processId);
        var contextPath = ResolvePath(processId, ".context.json");
        if (!File.Exists(bpmnPath) || !File.Exists(contextPath))
            throw new FileNotFoundException($"Process '{processId}' was not found.");

        await using var bpmnStream = File.OpenRead(bpmnPath);
        var document = await XDocument.LoadAsync(bpmnStream, LoadOptions.None, cancellationToken);
        await using var contextStream = File.OpenRead(contextPath);
        var context = await JsonSerializer.DeserializeAsync<ProcessContextDocument>(contextStream,
            new JsonSerializerOptions(JsonSerializerDefaults.Web), cancellationToken)
            ?? throw new InvalidDataException("Process context JSON is empty.");
        var elementContexts = context.Elements
            ?? throw new InvalidDataException("Process context JSON has no elements map.");

        var process = document.Root?.Elements(Bpmn + "process")
            .SingleOrDefault(element => string.Equals((string?)element.Attribute("id"), processId, StringComparison.Ordinal))
            ?? throw new InvalidDataException($"BPMN process '{processId}' is missing or duplicated.");

        var shapes = document.Descendants(BpmnDi + "BPMNShape")
            .ToDictionary(element => RequiredAttribute(element, "bpmnElement"), StringComparer.Ordinal);
        var diagramEdges = document.Descendants(BpmnDi + "BPMNEdge")
            .ToDictionary(element => RequiredAttribute(element, "bpmnElement"), StringComparer.Ordinal);

        var laneByNode = new Dictionary<string, string>(StringComparer.Ordinal);
        var lanes = process.Descendants(Bpmn + "lane").Select(lane =>
        {
            var id = RequiredAttribute(lane, "id");
            var bounds = RequiredBounds(shapes, id);
            foreach (var nodeReference in lane.Elements(Bpmn + "flowNodeRef"))
            {
                var nodeId = nodeReference.Value.Trim();
                if (!laneByNode.TryAdd(nodeId, id))
                    throw new InvalidDataException($"BPMN element '{nodeId}' belongs to more than one lane.");
            }
            return new LaneModel(id, OptionalAttribute(lane, "name") ?? id, bounds.Y, bounds.Height);
        }).OrderBy(lane => lane.Y).ToArray();

        if (lanes.Length == 0) throw new InvalidDataException("The BPMN process must contain at least one lane.");

        var nodes = process.Elements()
            .Where(element => SupportedNodeTypes.ContainsKey(element.Name.LocalName))
            .Select(element =>
            {
                var id = RequiredAttribute(element, "id");
                if (!laneByNode.TryGetValue(id, out var laneId))
                    throw new InvalidDataException($"BPMN element '{id}' is not assigned to a lane.");
                var bounds = RequiredBounds(shapes, id);
                elementContexts.TryGetValue(id, out var elementContext);
                return new NodeModel(
                    id,
                    SupportedNodeTypes[element.Name.LocalName],
                    OptionalAttribute(element, "name") ?? id,
                    laneId,
                    bounds.X,
                    bounds.Y,
                    bounds.Width,
                    bounds.Height,
                    elementContext?.Description,
                    elementContext?.Responsible,
                    elementContext?.Duration,
                    elementContext?.Artifacts ?? [],
                    elementContext?.Actions ?? []);
            }).ToArray();

        if (nodes.Length == 0) throw new InvalidDataException("The BPMN process contains no supported flow nodes.");
        var nodeIds = nodes.Select(node => node.Id).ToHashSet(StringComparer.Ordinal);

        var edges = process.Elements(Bpmn + "sequenceFlow").Select(element =>
        {
            var id = RequiredAttribute(element, "id");
            var sourceId = RequiredAttribute(element, "sourceRef");
            var targetId = RequiredAttribute(element, "targetRef");
            if (!nodeIds.Contains(sourceId) || !nodeIds.Contains(targetId))
                throw new InvalidDataException($"Sequence flow '{id}' references an unsupported or missing node.");
            if (!diagramEdges.TryGetValue(id, out var diagramEdge))
                throw new InvalidDataException($"Sequence flow '{id}' has no BPMN DI edge.");
            var points = diagramEdge.Elements(Di + "waypoint")
                .Select(point => new PointModel(RequiredNumber(point, "x"), RequiredNumber(point, "y")))
                .ToArray();
            if (points.Length < 2) throw new InvalidDataException($"Sequence flow '{id}' must have at least two waypoints.");
            return new EdgeModel(id, sourceId, targetId, OptionalAttribute(element, "name"), points);
        }).ToArray();

        return new ProcessModel(
            RequiredAttribute(process, "id"),
            OptionalAttribute(process, "name") ?? processId,
            context.Version,
            context.Owner,
            lanes,
            nodes,
            edges);
    }

    private string ResolvePath(string processId, string suffix)
    {
        if (!string.Equals(processId, "purchase-materials", StringComparison.OrdinalIgnoreCase))
            return Path.Combine(environment.ContentRootPath, "Data", $"__missing__{suffix}");
        return Path.Combine(environment.ContentRootPath, "Data", $"purchase-process{suffix}");
    }

    private static Bounds RequiredBounds(IReadOnlyDictionary<string, XElement> shapes, string elementId)
    {
        if (!shapes.TryGetValue(elementId, out var shape))
            throw new InvalidDataException($"BPMN element '{elementId}' has no BPMN DI shape.");
        var bounds = shape.Element(Dc + "Bounds")
            ?? throw new InvalidDataException($"BPMN element '{elementId}' has no bounds.");
        return new Bounds(
            RequiredNumber(bounds, "x"),
            RequiredNumber(bounds, "y"),
            RequiredNumber(bounds, "width"),
            RequiredNumber(bounds, "height"));
    }

    private static string RequiredAttribute(XElement element, string name) =>
        OptionalAttribute(element, name) ?? throw new InvalidDataException($"Element '{element.Name.LocalName}' has no '{name}' attribute.");

    private static string? OptionalAttribute(XElement element, string name) =>
        string.IsNullOrWhiteSpace((string?)element.Attribute(name)) ? null : ((string?)element.Attribute(name))!.Trim();

    private static double RequiredNumber(XElement element, string name)
    {
        var value = RequiredAttribute(element, name);
        return double.TryParse(value, NumberStyles.Float, CultureInfo.InvariantCulture, out var number)
            ? number
            : throw new InvalidDataException($"Attribute '{name}' on '{element.Name.LocalName}' is not a number.");
    }

    private sealed record Bounds(double X, double Y, double Width, double Height);
    private sealed record ProcessContextDocument(string Version, string Owner, Dictionary<string, ElementContext>? Elements);
    private sealed record ElementContext(
        string? Description,
        string? Responsible,
        string? Duration,
        IReadOnlyList<ArtifactModel>? Artifacts,
        IReadOnlyList<ActionModel>? Actions);
}
