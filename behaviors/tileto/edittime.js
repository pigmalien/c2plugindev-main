function GetBehaviorSettings() {
	return {
		"name": "Tile-To Path",
		"id": "TileToPath",
		"version": "1.0",
		"description": "Move a sprite across a grid, tile by tile.",
		"author": "Antigravity",
		"help url": "",
		"category": "Movements",
		"flags": 0
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
//				flags,				// (see docs) cf_none, cf_trigger, cf_fake_trigger, cf_static, cf_not_invertible,
//									// cf_deprecated, cf_incompatible_with_triggers, cf_looping
//				list_name,			// appears in event wizard list
//				category,			// category in event wizard list
//				display_str,		// as appears in event sheet - use {0}, {1} for parameters and also <b></b>, <i></i>, and {my} for the current behavior icon & name
//				description,		// appears in event wizard dialog when selected
//				script_name);		// corresponding runtime function name

// example				
AddCondition(0, cf_trigger, "On path finished", "Movement", "On path finished", "Triggered when the object arrives at the final destination.", "OnPathFinished");

AddCondition(1, cf_trigger, "On new tile reached", "Movement", "On new tile reached", "Triggered when the object arrives at a tile center.", "OnNewTileReached");

AddCondition(2, cf_none, "Is moving", "Movement", "{my} is moving", "True if the object is currently moving.", "IsMoving");

////////////////////////////////////////
// Actions

// AddAction(id,				// any positive integer to uniquely identify this action
//			 flags,				// (see docs) af_none, af_deprecated
//			 list_name,			// appears in event wizard list
//			 category,			// category in event wizard list
//			 display_str,		// as appears in event sheet - use {0}, {1} for parameters and also <b></b>, <i></i>
//			 description,		// appears in event wizard dialog when selected
//			 script_name);		// corresponding runtime function name

// example
AddNumberParam("Tile X", "The grid X coordinate to move to.");
AddNumberParam("Tile Y", "The grid Y coordinate to move to.");
AddAction(0, af_none, "Add tile to path", "Movement", "Add tile (<b>{0}</b>, <b>{1}</b>) to path", "Add a tile coordinate to the movement stack.", "AddTile");

AddAction(1, af_none, "Clear path stack", "Movement", "Clear path stack", "Clear all pending move targets.", "ClearStack");

AddAction(2, af_none, "Stop", "Movement", "Stop movement", "Stop moving immediately and clear the stack.", "StopMovement");

AddAction(3, af_none, "Move along path", "Movement", "Move along path", "Start moving along the queued path.", "StartPath");

////////////////////////////////////////
// Expressions

// AddExpression(id,			// any positive integer to uniquely identify this expression
//				 flags,			// (see docs) ef_none, ef_deprecated, ef_return_number, ef_return_string,
//								// ef_return_any, ef_variadic_parameters (one return flag must be specified)
//				 list_name,		// currently ignored, but set as if appeared in event wizard
//				 category,		// category in expressions panel
//				 exp_name,		// the expression name after the dot, e.g. "foo" for "myobject.foo" - also the runtime function name
//				 description);	// description in expressions panel

// example
AddExpression(0, ef_return_number, "Get stack count", "Movement", "StackCount", "Get the number of waypoints remaining in the stack.");

AddExpression(1, ef_return_number, "Get target X", "Movement", "TargetX", "Get the current target grid X coordinate.");

AddExpression(2, ef_return_number, "Get target Y", "Movement", "TargetY", "Get the current target grid Y coordinate.");

AddNumberParam("WorldX", "The world X coordinate to convert.");
AddExpression(3, ef_return_number, "World X to Tile X", "Conversion", "WorldToTileX", "Convert a world X coordinate to a grid column.");

AddNumberParam("WorldY", "The world Y coordinate to convert.");
AddExpression(4, ef_return_number, "World Y to Tile Y", "Conversion", "WorldToTileY", "Convert a world Y coordinate to a grid row.");

AddNumberParam("TileX", "The grid X coordinate to convert.");
AddExpression(5, ef_return_number, "Tile X to World X", "Conversion", "TileToWorldX", "Convert a grid column to a world X coordinate.");

AddNumberParam("TileY", "The grid Y coordinate to convert.");
AddExpression(6, ef_return_number, "Tile Y to World Y", "Conversion", "TileToWorldY", "Convert a grid row to a world Y coordinate.");

AddExpression(7, ef_return_number, "Get current path index", "Movement", "CurrentIndex", "Get the 0-based index of the current waypoint in the path.");

AddNumberParam("Index", "The 0-based index of the waypoint in the path.");
AddExpression(8, ef_return_number, "Path X at index", "Movement", "PathXAtIndex", "Get the tile X coordinate for a given waypoint index in the current path.");

AddNumberParam("Index", "The 0-based index of the waypoint in the path.");
AddExpression(9, ef_return_number, "Path Y at index", "Movement", "PathYAtIndex", "Get the tile Y coordinate for a given waypoint index in the current path.");

////////////////////////////////////////
ACESDone();

////////////////////////////////////////
// Array of property grid properties for this plugin
// new cr.Property(ept_integer,		name,	initial_value,	description)		// an integer value
// new cr.Property(ept_float,		name,	initial_value,	description)		// a float value
// new cr.Property(ept_text,		name,	initial_value,	description)		// a string
// new cr.Property(ept_combo,		name,	"Item 1",		description, "Item 1|Item 2|Item 3")	// a dropdown list (initial_value is string of initially selected item)

var property_list = [
	new cr.Property(ept_integer, "Tile Width", 32, "Width of a grid tile in pixels."),
	new cr.Property(ept_integer, "Tile Height", 32, "Height of a grid tile in pixels."),
	new cr.Property(ept_float, "Speed", 100, "Movement speed in pixels per second."),
	new cr.Property(ept_combo, "Allow Diagonals", "No", "Allow diagonal movement?", "No|Yes")
];

// Called by IDE when a new behavior type is to be created
function CreateIDEBehaviorType() {
	return new IDEBehaviorType();
}

// Class representing a behavior type in the IDE
function IDEBehaviorType() {
	assert2(this instanceof arguments.callee, "Constructor called as a function");
}

// Called by IDE when a new behavior instance of this type is to be created
IDEBehaviorType.prototype.CreateInstance = function (instance) {
	return new IDEInstance(instance, this);
}

// Class representing an individual instance of the behavior in the IDE
function IDEInstance(instance, type) {
	assert2(this instanceof arguments.callee, "Constructor called as a function");

	// Save the constructor parameters
	this.instance = instance;
	this.type = type;

	// Set the default property values from the property table
	this.properties = {};

	for (var i = 0; i < property_list.length; i++)
		this.properties[property_list[i].name] = property_list[i].initial_value;

	// any other properties here, e.g...
	// this.myValue = 0;
}

// Called by the IDE after all initialization on this instance has been completed
IDEInstance.prototype.OnCreate = function () {
}

// Called by the IDE after a property has been changed
IDEInstance.prototype.OnPropertyChanged = function (property_name) {
}
