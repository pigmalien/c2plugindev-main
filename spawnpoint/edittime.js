function GetPluginSettings()
﻿{
﻿	return {
﻿		"name":			"Spawn Point",
﻿		"id":			"SpawnPoint",
﻿		"version":		"1.0",
﻿		"description":	"A global plugin to manage spawn points either randomly outside an area or at a target object's position.",
﻿		"author":		"Gemini",
﻿		"help url":		"",
﻿		"category":		"General",
﻿		"type":			"object",
﻿		"flags":		pf_singleglobal
﻿	};
﻿};
﻿
﻿////////////////////////////////////////
﻿// Conditions
﻿AddCondition(0, cf_none, "Is random outside area", "Mode", "Is in random outside area mode", "True if the spawn point is set to spawn randomly outside an area.", "IsRandom");
﻿AddCondition(1, cf_none, "Has target object", "Target", "Has a target object", "True if a target object has been set.", "HasTargetObject");
﻿AddCondition(2, cf_trigger, "On point set", "Spawning", "On point set", "Triggered after the 'Set point' action.", "OnSetPoint");
﻿
﻿
﻿////////////////////////////////////////
﻿// Actions
﻿AddComboParamOption("Random outside area");
﻿AddComboParamOption("Target object");
﻿AddComboParam("Mode", "Set the spawn point mode.");
﻿AddAction(0, af_none, "Set mode", "Mode", "Set mode to {0}", "Set the spawn point mode.", "SetMode");
﻿
﻿AddNumberParam("X", "The X coordinate of the inner 'keep-out' area's top-left corner.");
﻿AddNumberParam("Y", "The Y coordinate of the inner 'keep-out' area's top-left corner.");
﻿AddNumberParam("Width", "The width of the 'keep-out' area.");
﻿AddNumberParam("Height", "The height of the 'keep-out' area.");
﻿AddAction(1, af_none, "Set random area", "Random", "Set 'keep-out' area to ({0}, {1}, {2}, {3})", "Set the inner 'keep-out' area for random spawning.", "SetRandomArea");
﻿
﻿AddNumberParam("Padding", "The padding from the edges of the 'keep-out' area.");
﻿AddAction(2, af_none, "Set padding", "Random", "Set padding to {0}", "Set the padding for the random area.", "SetPadding");
﻿
﻿AddAction(3, af_none, "Set point", "Spawning", "Set point", "Generate a point and trigger 'On point set'.", "SetPoint");
﻿
﻿AddObjectParam("Object", "The object to set as the target.");
﻿AddAction(4, af_none, "Set target object", "Target", "Set target to {0}", "Set the target object for spawning.", "SetTargetObject");
﻿
﻿AddAction(5, af_none, "Clear target object", "Target", "Clear target object", "Clear the currently set target object.", "ClearTargetObject");
﻿
﻿﻿
﻿
﻿////////////////////////////////////////
﻿// Expressions
﻿AddExpression(0, ef_return_number, "PointX", "Point", "PointX", "The X coordinate of the last generated point.");
﻿AddExpression(1, ef_return_number, "PointY", "Point", "PointY", "The Y coordinate of the last generated point.");﻿
﻿////////////////////////////////////////
﻿ACESDone();
﻿
﻿var property_list = [];
﻿	
﻿// Called by IDE when a new object type is to be created
﻿function CreateIDEObjectType()
﻿{
﻿	return new IDEObjectType();
﻿}
﻿
﻿// Class representing an object type in the IDE
﻿function IDEObjectType()
﻿{
﻿	assert2(this instanceof arguments.callee, "Constructor called as a function");
﻿}
﻿
﻿// Called by IDE when a new object instance of this type is to be created
﻿IDEObjectType.prototype.CreateInstance = function(instance)
﻿{
﻿	return new IDEInstance(instance);
﻿}
﻿
﻿// Class representing an individual instance of an object in the IDE
﻿function IDEInstance(instance, type)
﻿{
﻿	assert2(this instanceof arguments.callee, "Constructor called as a function");
﻿	
﻿	this.instance = instance;
﻿	this.type = type;
﻿	
﻿	this.properties = {};
﻿	
﻿	for (var i = 0; i < property_list.length; i++)
﻿		this.properties[property_list[i].name] = property_list[i].initial_value;
﻿}
﻿
﻿IDEInstance.prototype.OnDoubleClicked = function()
﻿{
﻿}
﻿
﻿IDEInstance.prototype.OnPropertyChanged = function(property_name)
﻿{
﻿}
﻿
﻿IDEInstance.prototype.OnRendererInit = function(renderer)
﻿{
﻿}
﻿
﻿IDEInstance.prototype.OnRendererReleased = function(renderer)
﻿{
﻿}
﻿﻿