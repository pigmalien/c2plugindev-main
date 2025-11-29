function GetPluginSettings()
{
	return {
		"name":			"Rich Text Renderer",
		"id":			"RichTextRenderer",
		"version":		"1.0",
		"description":	"Displays text with advanced formatting using markup, custom fonts, and effects.",
		"author":		"You",
		"help url":		"",
		"category":		"General",
		"type":			"world",			// "world" because it draws in the world
		"rotatable":	true,
		"flags":		pf_position_aces | pf_size_aces | pf_angle_aces | pf_appearance_aces | pf_zorder_aces
	};
}; // <-- THIS SEMICOLON IS CRUCIAL

////////////////////////////////////////
// Actions
AddStringParam("Text", "The text to display.");
AddAction(0, 0, "Set text", "Appearance", "Set text to {0}", "Set the object's text.", "SetText");

AddStringParam("Text", "The text to type out.");
AddNumberParam("Speed", "The speed of the typewriter effect, in characters per second.");
AddAction(1, 0, "Begin typewriter", "Typewriter", "Typewriter: set text to {0} at {1} chars/sec", "Begin a typewriter effect.", "BeginTypewriter");

AddStringParam("Font Name", "The name of the font to use (e.g., 'Arial').");
AddNumberParam("Font Size", "The size of the font in points.");
AddAction(2, 0, "Set default font", "Appearance", "Set default font to {0} ({1} pt)", "Set the default font name and size.", "SetDefaultFont");

AddNumberParam("Speed", "The new speed for the typewriter effect, in characters per second.");
AddAction(3, 0, "Set typewriter speed", "Typewriter", "Set typewriter speed to {0} chars/sec", "Change the speed of the typewriter effect while it is running.", "SetTypewriterSpeed");

////////////////////////////////////////
// Conditions
AddCondition(0, cf_trigger, "On typewriter finished", "Typewriter", "On typewriter finished", "Triggered when the typewriter effect completes.", "OnTypewriterFinished");
AddCondition(1, 0, "Is typewriter active", "Typewriter", "Is typewriter active", "True if the typewriter effect is currently running.", "IsTypewriterActive");

////////////////////////////////////////
// Expressions
AddExpression(0, ef_return_string, "Get text", "Text", "Text", "Get the current text of the object.");
AddExpression(1, ef_return_number, "Get typewriter speed", "Typewriter", "TypewriterSpeed", "Get the current speed of the typewriter effect.");

ACESDone();

////////////////////////////////////////
// Properties
var property_list = [
	new cr.Property(ept_text,	"Text",				"Hello, {b}world!{/b}",	"The text to display. Supports markup."),
	new cr.Property(ept_text,	"Font",				"Arial",				"The name of the font to use."),
	new cr.Property(ept_integer,"Size",				16,						"The font size in points."),
	new cr.Property(ept_color,	"Color",			"0,0,0",				"The default text color."),
	new cr.Property(ept_text,	"Custom Fonts",		"",						"A comma-separated list of font files (e.g., 'MyFont.ttf, OtherFont.otf') to load."),
	new cr.Property(ept_combo,	"Horizontal alignment",	"Left",			"The horizontal alignment of the text.", "Left|Center|Right"),
	new cr.Property(ept_combo,	"Vertical alignment",	"Top",			"The vertical alignment of the text.", "Top|Center|Bottom"),
	new cr.Property(ept_text,	"Markup Help",		"Markup tags:\n{b}bold{/b}\n{i}italic{/i}\n{color:red}colored text{/color} or {color:#ff0000}hex color{/color}\n{size:24}sized text{/size}\n{shake}shaking text{/shake}\n{shake:5}shaking text with magnitude{/shake}\n\nTypewriter only:\n{wait:500}\n{skip}",	"Read-only help for markup tags.")
];
	
// Called by IDE when a new object type is to be created
function CreateIDEObjectType()
{
	return new IDEObjectType();
}

// Class representing an object type in the IDE
function IDEObjectType()
{
	assert2(this instanceof arguments.callee, "Constructor called as a function");
}

// Called by IDE when a new object instance of this type is to be created
IDEObjectType.prototype.CreateInstance = function(instance)
{
	return new IDEInstance(instance);
}

// Class representing an individual instance of an object in the IDE
function IDEInstance(instance, type)
{
	assert2(this instanceof arguments.callee, "Constructor called as a function");
	
	// Save the constructor parameters
	this.instance = instance;
	this.type = type;
	
	// Set the default property values from the property table
	this.properties = {};
	
	for (prop in property_list)
		this.properties[property_list[prop].name] = property_list[prop].initial_value;
}

// Called when the IDE needs to draw this object instance
IDEInstance.prototype.Draw = function(renderer)
{
	// Since we removed pf_texture, we should draw a placeholder in the editor.
	// This code draws a simple box with the object's name.
	renderer.SetTexture(null);
	var quad = this.instance.GetBoundingQuad();
	renderer.Fill(quad, cr.RGB(230, 230, 230)); // Use a static light gray for the placeholder background
	renderer.Outline(quad, cr.RGB(0,0,0));
	
	if (!this.font)
		this.font = renderer.CreateFont("Arial", 14, false, false);
	
	if (this.font)
	{
		this.font.DrawText("RichText", quad, cr.RGB(0,0,0), ha_center);
	}
}

// Called by the IDE when the user edits a property
IDEInstance.prototype.OnPropertyChanged = function(property_name)
{
}

// Called by the IDE to get this object's properties
IDEInstance.prototype.GetProperties = function(obj)
{
	return this.properties;
}

// Called by the IDE to set this object's properties
IDEInstance.prototype.SetProperties = function(props)
{
	this.properties = props;
}