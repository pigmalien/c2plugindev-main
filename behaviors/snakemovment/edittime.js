function GetBehaviorSettings()
{
	return {
		"name":			"Snake Chain",
		"id":			"SnakeChain",
		"version":		"1.0",
		"description":	"Automatically generates and manages a chain of trailing body segments.",
		"author":		"Gemini Code Assist",
		"help url":		"",
		"category":		"Movements",
		"flags":		0
	};
};

////////////////////////////////////////
// Actions

// ACT 0: Build Chain
AddAction(0, af_none, "Build chain", "Chain", "Build chain", "Spawns and links all body segments.", "BuildChain");

// ACT 1: Destroy Chain
AddAction(1, af_none, "Destroy chain", "Chain", "Destroy chain", "Destroys all body segments.", "DestroyChain");

// ACT 2: Reorganise Chain
AddAction(2, af_none, "Reorganise chain", "Chain", "Reorganise chain", "Remove destroyed segments and close gaps.", "ReorganiseChain");

// ACT 3: Add Segment
AddAction(3, af_none, "Add segment", "Chain", "Add segment", "Add a new segment to the end of the chain.", "AddSegment");


////////////////////////////////////////
// Expressions
AddExpression(0, ef_return_number, "Segment Count", "Chain", "SegmentCount", "Return the number of active body segments.");


ACESDone();

var property_list = [
	new cr.Property(ept_integer, 	"Segments",		10,		"Number of body segments to create."),
	new cr.Property(ept_float,		"Spacing",		32,		"Distance (pixels) between segments."),
	new cr.Property(ept_float,		"Smoothness",	0.5,	"Follow smoothness (0.1 = loose, 1.0 = rigid)."),
	new cr.Property(ept_combo,		"Mode",			"Distance", "Movement logic.", "Distance|History"),
	new cr.Property(ept_text,		"Body Type Name", "",	"The name of the object type to use for body segments (must be in project).")
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
}