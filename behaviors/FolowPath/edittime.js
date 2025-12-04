function GetBehaviorSettings()
{
	return {
		"name":			"Follow Path",			// as appears in 'add behavior' dialog, can be changed as long as "id" stays the same
		"id":			"FollowPath",			// this is used to identify this behavior and is saved to the project; never change it
		"version":		"1.0",					// (float in x.y format) Behavior version - C2 shows compatibility warnings based on this
		"description":	"Move an object along a path of coordinates, with optional angle setting and corner rounding.",
		"author":		"Gemini Code Assist",
		"help url":		"",
		"category":		"Movements",				// Prefer to re-use existing categories, but you can set anything here
		"flags":		0						// uncomment lines to enable flags...
					//	| bf_onlyone			// can only be added once to an object, e.g. solid
	};
};

////////////////////////////////////////
// Parameter types:
// AddNumberParam(label, description [, initial_string = "0"])			// a number
// AddStringParam(label, description [, initial_string = "\"\""])		// a string
// AddAnyTypeParam(label, description [, initial_string = "0"])			// accepts either a number or string
// AddCmpParam(label, description)										// combo with equal, not equal, less, etc.
// AddComboParamOption(text)											// (repeat before "AddComboParam" to add combo items)
// AddComboParam(label, description [, initial_selection = 0])			// a dropdown list parameter
// AddObjectParam(label, description)									// a button to click and pick an object type
// AddLayerParam(label, description)									// accepts either a layer number or name (string)
// AddLayoutParam(label, description)									// a dropdown list with all project layouts
// AddKeybParam(label, description)										// a button to click and press a key (returns a VK)
// AddAudioFileParam(label, description)								// a dropdown list with all imported project audio files

////////////////////////////////////////
// Conditions

// AddCondition(id,					// any positive integer to uniquely identify this condition
//				flags,				// see docs
//				list_name,			// appears in event wizard
//				category,			// category in event wizard
//				display_str,		// as appears in event sheet
//				description,		// description in event wizard
//				script_name);		// runtime function name

AddCondition(0, cf_trigger, "On path finished", "Path", "On path finished", "Triggered when the object reaches the end of the path.", "OnPathFinished");
AddCondition(1, cf_none, "Is moving", "Path", "{my} is moving", "True if the object is currently moving along a path.", "IsMoving");

////////////////////////////////////////
// Actions

// AddAction(id,				// any positive integer to uniquely identify this action
//			 flags,				// see docs
//			 list_name,			// appears in event wizard
//			 category,			// category in event wizard
//			 display_str,		// as appears in event sheet
//			 description,		// description in event wizard
//			 script_name);		// runtime function name

AddNumberParam("X", "The X coordinate of the node to add to the path.");
AddNumberParam("Y", "The Y coordinate of the node to add to the path.");
AddAction(0, af_none, "Add node", "Path", "Add node at ({0}, {1})", "Add a new node to the end of the path.", "AddNode");

AddAction(1, af_none, "Clear path", "Path", "Clear path", "Remove all nodes from the path.", "ClearPath");

AddAction(2, af_none, "Start path", "Path", "Start moving", "Start moving along the defined path using the current speed property.", "StartPath");

AddAction(3, af_none, "Stop", "Path", "Stop", "Stop the object's movement.", "Stop");

AddNumberParam("Speed", "The new speed to set, in pixels per second.", "100");
AddAction(4, af_none, "Set speed", "Path", "Set speed to {0}", "Set the object's movement speed.", "SetSpeed");

AddNumberParam("Acceleration", "The new acceleration to set, in pixels per second per second.", "0");
AddAction(5, af_none, "Set acceleration", "Path", "Set acceleration to {0}", "Set the object's acceleration.", "SetAcceleration");

AddNumberParam("Deceleration", "The new deceleration to set, in pixels per second per second.", "0");
AddAction(6, af_none, "Set deceleration", "Path", "Set deceleration to {0}", "Set the object's deceleration.", "SetDeceleration");

AddNumberParam("Rounding", "The distance from a node to begin rounding the corner, in pixels.", "0");
AddAction(7, af_none, "Set corner rounding", "Path", "Set corner rounding to {0}", "Set the distance from a node to begin rounding the corner.", "SetRounding");

////////////////////////////////////////
// Expressions

// AddExpression(id, flags, list_name, category, exp_name, description);

AddExpression(0, ef_return_number, "CurrentSpeed", "Path", "CurrentSpeed", "The current speed of the object in pixels per second.");
AddExpression(1, ef_return_number, "PathNodeCount", "Path", "PathNodeCount", "The total number of nodes in the current path.");
AddExpression(2, ef_return_number, "CurrentNode", "Path", "CurrentNode", "The index of the current target node in the path.");

////////////////////////////////////////
ACESDone();

////////////////////////////////////////
// Array of property grid properties for this plugin
// new cr.Property(ept_integer,		name,	initial_value,	description)		// an integer value
// new cr.Property(ept_float,		name,	initial_value,	description)		// a float value
// new cr.Property(ept_text,		name,	initial_value,	description)		// a string
// new cr.Property(ept_combo,		name,	"Item 1",		description, "Item 1|Item 2|Item 3")	// a dropdown list (initial_value is string of initially selected item)

var property_list = [
	new cr.Property(ept_float, "Speed", 100, "The speed of movement, in pixels per second."),
	new cr.Property(ept_float, "Acceleration", 0, "The acceleration, in pixels per second per second."),
	new cr.Property(ept_float, "Deceleration", 0, "The deceleration, in pixels per second per second."),
	new cr.Property(ept_float, "Corner rounding", 0, "Distance from a node to begin rounding the corner. 0 for sharp corners.")
	];
	
// Called by IDE when a new behavior type is to be created
function CreateIDEBehaviorType()
{
	return new IDEBehaviorType();
}

// Class representing a behavior type in the IDE
function IDEBehaviorType()
{
	assert2(this instanceof arguments.callee, "Constructor called as a function");
}

// Called by IDE when a new behavior instance of this type is to be created
IDEBehaviorType.prototype.CreateInstance = function(instance)
{
	return new IDEInstance(instance, this);
}

// Class representing an individual instance of the behavior in the IDE
function IDEInstance(instance, type)
{
	assert2(this instanceof arguments.callee, "Constructor called as a function");
	
	// Save the constructor parameters
	this.instance = instance;
	this.type = type;
	
	// Set the default property values from the property table
	this.properties = {};
	
	for (var i = 0; i < property_list.length; i++)
		this.properties[property_list[i].name] = property_list[i].initial_value;
}

// Called by the IDE after all initialization on this instance has been completed
IDEInstance.prototype.OnCreate = function()
{
}

// Called by the IDE after a property has been changed
IDEInstance.prototype.OnPropertyChanged = function(property_name)
{
}