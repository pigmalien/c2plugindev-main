﻿function GetBehaviorSettings()
{
	return {
		"name":			"Find Path",
		"id":			"FindPath",
		"version":		"1.0",
		"description":	"Enables movement on a defined grid with pathfinding capabilities (A*).",
		"author":		"Gemini Code Assist",
		"help url":		"",
		"category":		"Movements",
		"flags":		0
	};
};

////////////////////////////////////////
// Actions

// ACT 0: Set Grid Size
AddNumberParam("Cell Width", "The horizontal size of one grid cell in pixels.", "32");
AddNumberParam("Cell Height", "The vertical size of one grid cell in pixels.", "32");
AddAction(0, af_none, "Set grid size", "Setup", "Set grid cell size to {0}x{1}", "Defines the grid dimensions.", "SetGridSize");

// ACT 1: Set Movement Speed
AddObjectParam("Object", "Select an object type to treat as a wall.");
AddAction(1, af_none, "Add wall obstacle", "Walls", "Add {0} as a wall obstacle", "Adds an object type to be treated as a wall.", "AddWallObstacle");

// ACT 2: Find Path
AddNumberParam("Target X", "The X coordinate (pixels) of the target.", "0");
AddNumberParam("Target Y", "The Y coordinate (pixels) of the target.", "0");
AddAction(2, af_none, "Find path to", "Pathfinding", "Find path to ({0}, {1})", "Calculates a path using A*.", "FindPath");

// ACT 3: Clear Wall Obstacles
AddAction(3, af_none, "Clear all wall obstacles", "Walls", "Clear all wall obstacles", "Removes all object types from the wall obstacle list.", "ClearWallObstacles");

////////////////////////////////////////
// Conditions

// CND 0: On Path Found
AddCondition(0, cf_trigger, "On path found", "Pathfinding", "On path found", "Triggers after a path has been successfully calculated.", "OnPathFound");

// CND 1: On Path Failed
AddCondition(1, cf_trigger, "On path failed", "Pathfinding", "On path failed", "Triggers if no path could be found to the target.", "OnPathFailed");

// CND 2: For Each Node
AddCondition(2, cf_looping | cf_not_invertible, "For each node", "Path", "For each node in path", "Loop through each node in the calculated path.", "ForEachNode");

////////////////////////////////////////
// Expressions

// EXP 0: PathNodeCount
AddExpression(0, ef_return_number, "PathNodeCount", "Path", "PathNodeCount", "Returns the number of nodes in the current path.");

// EXP 1: PathNodeXAt
AddNumberParam("Index", "The index of the path node to retrieve.");
AddExpression(1, ef_return_number, "PathNodeXAt", "Path", "PathNodeXAt", "Returns the X coordinate of a node in the path.");

// EXP 2: PathNodeYAt
AddNumberParam("Index", "The index of the path node to retrieve.");
AddExpression(2, ef_return_number, "PathNodeYAt", "Path", "PathNodeYAt", "Returns the Y coordinate of a node in the path.");

// EXP 3: CurrentNodeIndex
AddExpression(3, ef_return_number, "CurrentNodeIndex", "Path", "CurrentNodeIndex", "Get the index of the current node in a 'For each node' loop.");

ACESDone();

var property_list = [
	new cr.Property(ept_integer, 	"Cell Width",	32,		"The width of a single grid cell."),
	new cr.Property(ept_integer,	"Cell Height",	32,		"The height of a single grid cell."),
	new cr.Property(ept_integer,	"Max Iterations", 15000, "The maximum search iterations before pathfinding fails."),
	];
	
function CreateIDEBehaviorType() { return new IDEBehaviorType(); }
function IDEBehaviorType() { assert2(this instanceof arguments.callee, "Constructor called as a function"); }
IDEBehaviorType.prototype.CreateInstance = function(instance) { return new IDEInstance(instance, this); }

function IDEInstance(instance, type)
{
	assert2(this instanceof arguments.callee, "Constructor called as a function");
	this.instance = instance;
	this.type = type;
	this.properties = {};
	
	for (var i = 0; i < property_list.length; i++)
		this.properties[property_list[i].name] = property_list[i].initial_value;
}

IDEInstance.prototype.OnPropertyChanged = function(property_name)
{
	// No specific IDE logic needed for property changes here, the runtime handles it.
}