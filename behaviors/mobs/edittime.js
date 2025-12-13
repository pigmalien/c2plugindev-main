﻿function GetBehaviorSettings()
{
	return {
		"name":			"Mobs Movement",			// as appears in 'add behavior' dialog, can be changed as long as "id" stays the same
		"id":			"MobsMovement",			// this is used to identify this behavior and is saved to the project; never change it
		"version":		"1.0",					// (float in x.y format) Behavior version - C2 shows compatibility warnings based on this
		"description":	"Moves an object towards a target while avoiding other objects with the same behavior.",
		"author":		"Gemini Code Assist",
		"help url":		"",
		"category":		"Movements",				// Prefer to re-use existing categories, but you can set anything here
		"flags":		bf_onlyone						// uncomment lines to enable flags...
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
//				flags,				// (see docs) cf_none, cf_trigger, cf_fake_trigger, cf_static, cf_not_invertible,
//									// cf_deprecated, cf_incompatible_with_triggers, cf_looping
//				list_name,			// appears in event wizard list
//				category,			// category in event wizard list
//				display_str,		// as appears in event sheet - use {0}, {1} for parameters and also <b></b>, <i></i>, and {my} for the current behavior icon & name
//				description,		// appears in event wizard dialog when selected
//				script_name);		// corresponding runtime function name
				
AddCondition(0, cf_none, "Is active", "State", "{my} is active", "True if the behavior is currently active.", "IsActive");
////////////////////////////////////////
// Actions

// AddAction(id,				// any positive integer to uniquely identify this action
//			 flags,				// (see docs) af_none, af_deprecated
//			 list_name,			// appears in event wizard list
//			 category,			// category in event wizard list
//			 display_str,		// as appears in event sheet - use {0}, {1} for parameters and also <b></b>, <i></i>
//			 description,		// appears in event wizard dialog when selected
//			 script_name);		// corresponding runtime function name

AddObjectParam("Target", "The object to move towards.");
AddAction(0, af_none, "Set target", "Target", "Set target to {0}", "Set the object to follow.", "SetTarget");
AddAction(1, af_none, "Set active", "State", "Set {my} active", "Enable the flocking movement behavior.", "SetActive");
AddAction(2, af_none, "Set inactive", "State", "Set {my} inactive", "Disable the flocking movement behavior.", "SetInactive");

AddNumberParam("Speed", "The new maximum speed in pixels per second.");
AddAction(3, af_none, "Set max speed", "Parameters", "Set max speed to {0}", "Set the maximum speed for the object.", "SetMaxSpeed");
AddNumberParam("Speed", "The new rotation speed (e.g., 4 for normal).");
AddAction(4, af_none, "Set rotation speed", "Parameters", "Set rotation speed to {0}", "Set the rotation speed for the object.", "SetRotationSpeed");
AddNumberParam("Radius", "The new repulsion radius in pixels.");
AddAction(5, af_none, "Set repulsion radius", "Parameters", "Set repulsion radius to {0}", "Set the repulsion radius for the object.", "SetRepulsionRadius");
AddNumberParam("Force", "The new repulsion force (0 to 1).");
AddAction(6, af_none, "Set repulsion force", "Parameters", "Set repulsion force to {0}", "Set the repulsion force for the object.", "SetRepulsionForce");

////////////////////////////////////////
// Expressions

// AddExpression(id,			// any positive integer to uniquely identify this expression
//				 flags,			// (see docs) ef_none, ef_deprecated, ef_return_number, ef_return_string,
//								// ef_return_any, ef_variadic_parameters (one return flag must be specified)
//				 list_name,		// currently ignored, but set as if appeared in event wizard
//				 category,		// category in expressions panel
//				 exp_name,		// the expression name after the dot, e.g. "foo" for "myobject.foo" - also the runtime function name
//				 description);	// description in expressions panel

////////////////////////////////////////
ACESDone();

////////////////////////////////////////
// Array of property grid properties for this plugin
// new cr.Property(ept_integer,		name,	initial_value,	description)		// an integer value
// new cr.Property(ept_float,		name,	initial_value,	description)		// a float value
// new cr.Property(ept_text,		name,	initial_value,	description)		// a string
// new cr.Property(ept_combo,		name,	"Item 1",		description, "Item 1|Item 2|Item 3")	// a dropdown list (initial_value is string of initially selected item)

var property_list = [
	new cr.Property(ept_combo,	"Initial state",	"Active",		"Set whether the behavior is initially active or inactive.", "Active|Inactive"),
	new cr.Property(ept_float, 	"Max speed",		120,	"The maximum speed of the object, in pixels per second."),
	new cr.Property(ept_float, 	"Rotation speed",	4,		"The speed at which the object rotates to face its direction, from 0 (none) to 100 (instant)."),
	new cr.Property(ept_combo,	"Flip",				"None",			"Automatically flip the object's appearance. Only applies if 'Rotation speed' is 0.", "None|Horizontal"),
	new cr.Property(ept_float, 	"Repulsion radius",	40,		"The distance at which objects will start pushing each other away."),
	new cr.Property(ept_float, 	"Repulsion force",	0.8,	"The strength of the push-away force, from 0 to 1.")
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
		
	// any other properties here, e.g...
	// this.myValue = 0;
}

// Called by the IDE after all initialization on this instance has been completed
IDEInstance.prototype.OnCreate = function()
{
}

// Called by the IDE after a property has been changed
IDEInstance.prototype.OnPropertyChanged = function(property_name)
{
}
