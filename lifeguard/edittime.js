function GetPluginSettings()
{
	return {
		"name":			"Lifeguard",
		"id":			"Lifeguard",
		"version":		"1.0",
		"description":	"A universal singleton plugin for Object Pooling, Global Events, and game flow control.",
		"author":		"Gemini Code Assist",
		"help url":		"",
		"category":		"General",
		"type":			"object",			// Non-drawing plugin
		"flags":		pf_singleglobal		// Acts as a singleton object
	};
};

////////////////////////////////////////
// Parameter types:
// AddNumberParam(label, description [, initial_string = "0"])			// a number
// AddStringParam(label, description [, initial_string = "\"\""])		// a string
// AddAnyTypeParam(label, description [, initial_string = "0"])			// accepts either a number or string
// AddCmpParam(label, description)										// combo with equal, not equal, less, etc.
// AddComboParamOption(text)											// (repeat before "AddComboParam" to add combo items)
// AddComboParam(label, description [, initial_selection = 0] [, initial_string = "\"\""])	// (uses AddComboParamOption) a dropdown list
// AddObjectParam(label, description)									// a single object type - gives user a dropdown to select object type.
// AddLayerParam(label, description [, initial_selection = -1])			// a layer number
// AddRetParam(type, label)												// for expressions
// AddAudioFileParam(label, description)								// a sound file
// AddFileParam(label, description)										// a general file
// AddTextParam(label, description)										// a textarea string.
// AddCmpParam(label, description)										// comparison
// AddEventParam(label, description)									// event-specific parameters
// AddProperty(type, name, initial_value, description)					// behavior properties

////////////////////////////////////////
// Conditions

// CND: On Spawned (Trigger)
AddObjectParam("Object", "Select the object type that was spawned.");
AddCondition(1, cf_trigger, "On object spawned from pool", "Pooling", "On {0} spawned from pool", "Triggers when an instance of an object is spawned from the pool.", "OnSpawned");

// CND: On Global Event (Trigger)
AddStringParam("Event Name", "The name of the global event to listen for (e.g., \"PlayerDied\").");
AddCondition(2, cf_trigger, "On global event", "Global Events", "On global event {0}", "Triggers when a specific global event is fired.", "OnGlobalEvent");

////////////////////////////////////////
// Actions

// ACT: Setup Pool
AddObjectParam("Object Type to Pool", "Choose the object type (e.g., Bullet) to set up for pooling.");
AddNumberParam("Initial Quantity", "The number of instances to pre-create and store in the pool.", "10");
AddAction(1, af_none, "Setup pool", "Pooling", "Setup pool for {0} with initial count {1}", "Pre-creates and initializes the pool for an object type.", "SetupPool");

// ACT: Spawn Instance
AddObjectParam("Object Type to Spawn", "Choose the object type to retrieve from the pool.");
AddNumberParam("X position", "The X coordinate where the instance should be placed.", "0");
AddNumberParam("Y position", "The Y coordinate where the instance should be placed.", "0");
AddAction(2, af_none, "Spawn instance", "Pooling", "Spawn {0} at ({1}, {2})", "Retrieves a hidden instance from the pool, makes it visible, and positions it.", "SpawnInstance");

// ACT: Trigger Global Event
AddStringParam("Event Name", "The name of the global event to trigger (e.g., \"PlayerDied\").");
AddAction(3, af_none, "Trigger global event", "Global Events", "Trigger global event {0}", "Triggers a global event that any Lifeguard instance can listen for.", "TriggerGlobalEvent");

// ACT: Return Instance to Pool
AddObjectParam("Instance", "The object instance to return to the pool. Only picked instances will be affected.");
AddAction(4, af_none, "Return instance to pool", "Pooling", "Return {0} to pool", "Returns a picked object instance to its pool, making it available for reuse.", "ReturnInstance");

// ACT: Return All Active Instances
AddObjectParam("Object Type", "The object type to return all active instances of.");
AddAction(5, af_none, "Return all active instances", "Pooling", "Return all active {0} to pool", "Returns all visible instances of an object type to their pool.", "ReturnAllActive");

////////////////////////////////////////
// Expressions

// EXP: PoolActiveCount
AddObjectParam("Object Type", "The object type to get the active count for.");
AddExpression(0, ef_return_number, "PoolActiveCount", "Pooling", "PoolActiveCount", "Get the number of active (visible) instances in an object's pool.");

// EXP: PoolTotalCount
AddObjectParam("Object Type", "The object type to get the total count for.");
AddExpression(1, ef_return_number, "PoolTotalCount", "Pooling", "PoolTotalCount", "Get the total number of instances (active and inactive) in an object's pool.");

ACESDone();

// Property list.
var property_list = [
	];
	
// Called by IDE when a new plugin type is to be created
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
	
	for (var i = 0; i < property_list.length; i++)
		this.properties[property_list[i].name] = property_list[i].initial_value;
}

// Called by the IDE when the user edits a property
IDEInstance.prototype.OnPropertyChanged = function(property_name)
{
}

// Called by the IDE when the user double-clicks the object
// Not used in this plugin
IDEInstance.prototype.OnDoubleClicked = function()
{
}

// Called by the IDE when the object instance is being destroyed
IDEInstance.prototype.OnDestroy = function()
{
}

// Called by the IDE after a property has been changed
IDEInstance.prototype.Draw = function(renderer)
{
}