﻿function GetBehaviorSettings()
{
	return {
		"name":			"Field Swarm", // Updated name
		"id":			"FieldSwarm",  // Updated ID
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
AddNumberParam("Speed", "The speed of movement in cells per second.", "5");
AddAction(1, af_none, "Set move speed", "Movement", "Set movement speed to {0} cells/sec", "Sets the rate at which the object traverses cells.", "SetMoveSpeed");

// ACT 2: Find Path
AddNumberParam("Target X", "The X coordinate (pixels) of the target.", "0");
AddNumberParam("Target Y", "The Y coordinate (pixels) of the target.", "0");
AddAction(2, af_none, "Find path to", "Pathfinding", "Find path to ({0}, {1})", "Calculates a path using A*.", "FindPath");

// ACT 3: Start moving
AddAction(3, af_none, "Move along path", "Movement", "Start moving along current path", "Begins movement toward the target.", "MoveAlongPath");

// ACT 4: Add Wall Obstacle
AddObjectParam("Object", "Select an object type to treat as a wall.");
AddAction(4, af_none, "Add wall obstacle", "Walls", "Add {0} as a wall obstacle", "Adds an object type to be treated as a wall.", "AddWallObstacle");

// ACT 5: Clear Wall Obstacles
AddAction(5, af_none, "Clear all wall obstacles", "Walls", "Clear all wall obstacles", "Removes all object types from the wall obstacle list.", "ClearWallObstacles");

////////////////////////////////////////
// Conditions

// CND 0: On Path Found
AddCondition(0, cf_trigger, "On path found", "Pathfinding", "On path found", "Triggers after a path has been successfully calculated.", "OnPathFound");

// CND 1: On Path Failed
AddCondition(1, cf_trigger, "On path failed", "Pathfinding", "On path failed", "Triggers if no path could be found to the target.", "OnPathFailed");

// CND 2: On Movement Finished
AddCondition(2, cf_trigger, "On movement finished", "Movement", "On movement finished", "Triggers when the object reaches its target cell.", "OnMoveFinished");

// CND 3: Is Moving
AddCondition(3, cf_none, "Is moving", "Movement", "Is moving", "Returns true while the object is traversing cells.", "IsMoving");


////////////////////////////////////////
// Expressions

// EXP 0: Target Grid X
AddExpression(0, ef_return_number, "Target Grid X", "Pathfinding", "TargetGridX", "Returns the grid X index of the current target cell.");

// EXP 1: Target Grid Y
AddExpression(1, ef_return_number, "Target Grid Y", "Pathfinding", "TargetGridY", "Returns the grid Y index of the current target cell.");


ACESDone();

var property_list = [
	new cr.Property(ept_integer, 	"Cell Width",	32,		"The width of a single grid cell."),
	new cr.Property(ept_integer,	"Cell Height",	32,		"The height of a single grid cell."),
	new cr.Property(ept_float,		"Move Speed",	5,		"The speed in cells per second."),
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