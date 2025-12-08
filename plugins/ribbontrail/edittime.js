function GetPluginSettings() {
	return {
		"name": "RibbonTrail",
		"id": "RibbonTrail",
		"version": "1.0",
		"description": "A performant, continuous ribbon mesh trail plugin.",
		"author": "Antigravity",
		"help url": "https://www.construct.net/en/construct-2/manuals/construct-2-javascript-sdk",
		"category": "General",
		"type": "world",
		"rotatable": true,
		"flags": pf_texture | pf_position_aces | pf_size_aces | pf_angle_aces | pf_zorder_aces | pf_appearance_aces

	};
};

////////////////////////////////////////
// Parameter types:
// AddNumberParam(label, description [, initial_string = "0"])
// AddStringParam(label, description [, initial_string = "\"\""])
// AddAnyTypeParam(label, description [, initial_string = "0"])
// AddCmpParam(label, description)
// AddComboParamOption(text)
// AddComboParam(label, description [, initial_selection = 0])
// AddObjectParam(label, description)
// AddLayerParam(label, description)
// AddLayoutParam(label, description)
// AddKeybParam(label, description)
// AddAnimationParam(label, description)
// AddAudioFileParam(label, description)

////////////////////////////////////////
// Conditions

////////////////////////////////////////
// Actions

AddNumberParam("X", "The X coordinate tracking position.");
AddNumberParam("Y", "The Y coordinate tracking position.");
AddAction(0, af_none, "Update Trail Position", "Ribbon", "Update trail position by ({0}, {1})", "Add a new tracking point to the ribbon trail.", "UpdateTrailPosition");

////////////////////////////////////////
// Expressions
ACESDone();

////////////////////////////////////////
// Array of property grid properties for this plugin
var property_list = [
	new cr.Property(ept_float, "Ribbon Width", 40, "The maximum width of the ribbon mesh at its head (in pixels)."),
	new cr.Property(ept_float, "Trail Lifespan", 0.5, "The total duration (in seconds) that a segment of the ribbon persists.")
];

// Called by IDE when a new object type is to be created
function CreateIDEObjectType() {
	return new IDEObjectType();
}

// Class representing an object type in the IDE
function IDEObjectType() {
	assert2(this instanceof arguments.callee, "Constructor called as a function");
}

// Called by IDE when a new object instance of this type is to be created
IDEObjectType.prototype.CreateInstance = function (instance) {
	return new IDEInstance(instance);
}

// Class representing an individual instance of an object in the IDE
function IDEInstance(instance, type) {
	assert2(this instanceof arguments.callee, "Constructor called as a function");

	// Save the constructor parameters
	this.instance = instance;
	this.type = type;

	// Set the default property values from the property table
	this.properties = {};

	for (var i = 0; i < property_list.length; i++)
		this.properties[property_list[i].name] = property_list[i].initial_value;
}

// Called when inserted via Insert Object Dialog for the first time
IDEInstance.prototype.OnInserted = function () {
}

// Called when double clicked in layout
IDEInstance.prototype.OnDoubleClicked = function () {
	this.instance.EditTexture();
}


// Called after a property has been changed in the properties bar
IDEInstance.prototype.OnPropertyChanged = function (property_name) {
}

// For rendered objects to load fonts or textures
IDEInstance.prototype.OnRendererInit = function (renderer) {
}

// Called to draw self in the editor if a layout object
IDEInstance.prototype.Draw = function (renderer) {
	// Draw a simple representation in the editor
	renderer.SetTexture(this.instance.GetTexture());
	var q = this.instance.GetBoundingQuad();
	renderer.Quad(q, this.instance.GetOpacity());
	renderer.Outline(q, cr.RGB(0, 0, 0));
}

// For rendered objects to release fonts or textures
IDEInstance.prototype.OnRendererReleased = function (renderer) {
}