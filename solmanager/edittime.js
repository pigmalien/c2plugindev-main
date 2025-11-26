// ECMAScript 5 strict mode
"use strict";

// Global behavior flags
var bf_onlyone = 0;

// Global expression flags
var ef_return_number = 0;
var ef_no_picking = 2;

function GetBehaviorSettings()
{
	return {
		"name":			"SOL Manager",
		"id":			"SOLManager",
		"version":		"1.1",
		"description":	"Manages links to other instances by their UID.",
		"author":		"Scirra",
		"help url":		"",
		"category":		"Data & Instances",
		"flags":		bf_onlyone
	};
};

////////////////////////////////////////
// Property flags
var pf_singleglobal = 1;

////////////////////////////////////////
// Properties
var property_list = [
	// No properties needed for this behavior
];

function GetProperties()
{
	return property_list;
}
////////////////////////////////////////
// Parameter types:
// AddObjectParam(label, description)				// a JavaScript object type
// AddNumberParam(label, description [, initial_string = "0"])
// AddAnyTypeParam(label, description [, initial_string = "0"])
// AddComboParamOption(text)					
// AddComboParam(label, description [, initial_selection = 0])
// AddExpressionParam(label, description [, initial_string = "0"])


////////////////////////////////////////
// Conditions
AddObjectParam("Target object", "The type of object to check for a linked instance.");
AddCondition(0, 0, "Has linked instance of", "Linking", "If {0} has a linked instance", "Check if a linked instance is stored.", "HasLinkedInstance");

AddObjectParam("Target object", "The type of object whose linked instance should be picked.");
AddCondition(1, 0, "Pick linked instance", "Linking", "Pick linked {0}", "Select the linked instance for actions.", "PickLinkedInstance");

////////////////////////////////////////
// Actions
AddObjectParam("Target object", "The object type to link to.");
AddNumberParam("Instance UID", "The UID of the specific instance to link to.");
AddAction(0, 0, "Link instance by UID", "Linking", "Link to {0} instance with UID {1}", "Establish a permanent link to a specific instance via its unique ID.", "LinkByUID");

AddObjectParam("Target object", "The object type for which to clear the link.");
AddAction(1, 0, "Clear link", "Linking", "Clear link for {0}", "Remove the link to an instance of a specific object type.", "ClearLink");

////////////////////////////////////////
// Expressions
AddObjectParam("Object", "The object type to get the linked UID for.");
AddExpression(0, ef_return_number | ef_no_picking, "Get Linked UID", "Linking", "LinkedUID", "Return the Unique ID (UID) of the currently linked instance (0 if none).");


////////////////////////////////////////
// The IDE code is required as normal.
// You do not need to alter any code below here.
// You do not need to alter any code below here.
	
// Called by IDE when a new behavior type is to be created
function CreateIDEBehaviorType()
{
	return new IDEBehaviorType();
}

// Class representing a behavior type in the IDE
function IDEBehaviorType()
{
	assert2(this instanceof IDEBehaviorType, "Constructor called as a function");
}

// Called by IDE when a new behavior instance of this type is to be created
IDEBehaviorType.prototype.CreateInstance = function(instance)
{
	return new IDEInstance(instance, this);
};

// Class representing an individual instance of the behavior in the IDE
function IDEInstance(instance, type)
{
	assert2(this instanceof IDEInstance, "Constructor called as a function");
	
	// Save the constructor parameters
	this.instance = instance;
	this.type = type;
	
	// Set the default property values from the property table
	this.properties = {};
	
	for (var i = 0; i < property_list.length; i++)
		this.properties[property_list[i].name] = property_list[i].initial_value;
}

// Called by the IDE after a property has been changed
IDEInstance.prototype.OnPropertyChanged = function(property_name)
{
};