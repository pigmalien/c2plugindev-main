function GetPluginSettings() {
	return {
		"name": "Itch.io",
		"id": "ItchIO",
		"version": "1.0",
		"description": "Integrate with Itch.io API. Supports secure environment variable authentication.",
		"author": "Scirra/Antigravity",
		"help url": "https://itch.io/docs/api",
		"category": "Web",
		"type": "object",			// not a world object
		"rotatable": false,
		"flags": pf_singleglobal
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

AddCondition(0, cf_trigger, "On login success", "Authentication", "On login success", "Triggered when authentication is successful.", "OnLoginSuccess");
AddCondition(1, cf_trigger, "On login error", "Authentication", "On login error", "Triggered when authentication fails.", "OnLoginError");

AddCondition(2, cf_none, "Is logged in", "Authentication", "Is logged in", "True if a valid API key is present.", "IsLoggedIn");

AddCondition(5, cf_trigger, "On my games received", "Data", "On my games received", "Triggered when the list of games is received.", "OnMyGamesReceived");
AddCondition(6, cf_trigger, "On purchase check complete", "Data", "On purchase check complete", "Triggered after checking ownership status.", "OnPurchaseChecked");
AddCondition(7, cf_none, "Is owned", "Data", "Is owned", "True if the last purchase check returned a valid purchase.", "IsOwned");

////////////////////////////////////////
// Actions

AddAction(0, af_none, "Attempt Login", "Authentication", "Attempt login (Auto/Env)", "Try to find the API Key from the environment (Secure) or properties.", "Login");
AddStringParam("API Key", "Manually set the API Key (INSECURE if used in public builds). Leave empty to keep existing key.");
AddAction(1, af_none, "Set API Key", "Authentication", "Set API Key to {0}", "Manually set the API Key.", "SetAPIKey");

AddAction(2, af_none, "Request User Profile", "Data", "Request user profile", "Fetch the current user's profile information.", "RequestProfile");

AddStringParam("URL", "The API endpoint URL (relative to https://itch.io/api/1/key/).");
AddAction(3, af_none, "Generic Request", "Data", "Request {0}", "Make a generic authenticated GET request.", "GenericRequest");

AddAction(4, af_none, "Request My Games", "Data", "Request my games", "Fetch the list of games you have uploaded or have access to.", "RequestMyGames");

AddAnyTypeParam("Game ID", "The ID of the game to check ownership for.");
AddAction(5, af_none, "Check Ownership", "Data", "Check ownership of game {0}", "Check if the current user owns the specified game ID.", "CheckOwnership");

////////////////////////////////////////
// Expressions

AddExpression(0, ef_return_string, "Get Current API Key", "Authentication", "APIKey", "Get the currently used API Key (use with caution).");
AddExpression(1, ef_return_string, "Get Username", "User", "Username", "Get the username from the profile.");
AddExpression(2, ef_return_number, "Get User ID", "User", "UserID", "Get the user ID from the profile.");
AddExpression(3, ef_return_string, "Get Profile URL", "User", "ProfileURL", "Get the profile URL.");
AddExpression(4, ef_return_string, "Get Last Error", "General", "LastError", "Get the last error message.");
AddExpression(5, ef_return_string, "Get Last Data", "General", "LastData", "Get the last raw JSON response.");

AddExpression(6, ef_return_number, "Get Game Count", "My Games", "GameCount", "Get the number of games retrieved.");
AddExpression(7, ef_return_string, "Get Game Title", "My Games", "GameTitle", "Get the title of a game at index (0-based).");
AddExpression(8, ef_return_number, "Get Game ID", "My Games", "GameID", "Get the ID of a game at index (0-based).");
AddExpression(9, ef_return_number, "Is Owned Value", "Data", "IsOwnedValue", "Returns 1 if owned, 0 if not (based on last check).");

////////////////////////////////////////
ACESDone();

////////////////////////////////////////
// properties

var property_list = [
	new cr.Property(ept_combo, "API Key Source", "Environment Variable", "Where to look for the API Key. 'Environment Variable' is secure for Itch app. 'Manual' is insecure.", "Environment Variable|Manual"),
	new cr.Property(ept_text, "Manual API Key", "", "Enter API Key here ONLY if using 'Manual' source. WARNING: This is visible in the source!")
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
}

// Called after a property has been changed in the properties bar
IDEInstance.prototype.OnPropertyChanged = function (property_name) {
}

// For rendered objects to load fonts or textures
IDEInstance.prototype.OnRendererInit = function (renderer) {
}

// Called to draw self in the editor if a layout object
IDEInstance.prototype.Draw = function (renderer) {
}

// For rendered objects to release fonts or textures
IDEInstance.prototype.OnRendererReleased = function (renderer) {
}