// ECMAScript 5 strict mode
"use strict";

assert2(cr, "cr namespace not created");
assert2(cr.plugins_, "cr.plugins_ not created");

cr.plugins_.SpawnPoint = function(runtime)
{
	this.runtime = runtime;
};

(function ()
{
	var pluginProto = cr.plugins_.SpawnPoint.prototype;
		
	pluginProto.Type = function(plugin)
	{
		this.plugin = plugin;
		this.runtime = plugin.runtime;
	};

	var typeProto = pluginProto.Type.prototype;

	typeProto.onCreate = function()
	{
	};

	pluginProto.Instance = function(type)
	{
		this.type = type;
		this.runtime = type.runtime;
	};
	
	var instanceProto = pluginProto.Instance.prototype;

	instanceProto.onCreate = function()
	{
		this.mode_is_random = true; // true = random, false = target
		this.area_x = 0;
		this.area_y = 0;
		this.area_w = 100;
		this.area_h = 100;
		this.padding = 0;

		this.pointX = 0;
		this.pointY = 0;
		
		this.target_uid = -1;
		this.target_x = 0;
		this.target_y = 0;

		this.runtime.tick(this);
	};

	instanceProto.tick = function()
	{
		if (this.target_uid === -1)
			return;

		var inst = this.runtime.getObjectByUID(this.target_uid);
		if (!inst)
		{
			this.target_uid = -1;
			return;
		}
		
		this.target_x = inst.x;
		this.target_y = inst.y;
	};

	instanceProto.onDestroy = function ()
	{
	};
	
	instanceProto.saveToJSON = function ()
	{
		return {
			"mir": this.mode_is_random,
			"ax": this.area_x,
			"ay": this.area_y,
			"aw": this.area_w,
			"ah": this.area_h,
			"p": this.padding,
			"px": this.pointX,
			"py": this.pointY,
			"tuid": this.target_uid
		};
	};
	
	instanceProto.loadFromJSON = function (o)
	{
		this.mode_is_random = o["mir"];
		this.area_x = o["ax"];
		this.area_y = o["ay"];
		this.area_w = o["aw"];
		this.area_h = o["ah"];
		this.padding = o["p"];
		this.pointX = o["px"];
		this.pointY = o["py"];
		this.target_uid = o["tuid"];
	};

	function Cnds() {};
	Cnds.prototype.IsRandom = function () { return this.mode_is_random; };
	Cnds.prototype.HasTargetObject = function () { return this.target_uid !== -1; };
	Cnds.prototype.OnSetPoint = function () { return true; };
	pluginProto.cnds = new Cnds();
	
	function Acts() {};

	Acts.prototype.SetMode = function (mode) { this.mode_is_random = (mode === 0); };
	Acts.prototype.SetRandomArea = function (x, y, w, h) { this.area_x = x; this.area_y = y; this.area_w = w; this.area_h = h; };
	Acts.prototype.SetPadding = function (padding) { this.padding = padding; };

	Acts.prototype.SetPoint = function () {
		var x = 0;
		var y = 0;

		if (this.mode_is_random) {
			// Define inner "keep-out" zone, expanded by padding
			var inner_x1 = this.area_x - this.padding;
			var inner_y1 = this.area_y - this.padding;
			var inner_w = this.area_w + (this.padding * 2);
			var inner_h = this.area_h + (this.padding * 2);
			var inner_x2 = inner_x1 + inner_w;
			var inner_y2 = inner_y1 + inner_h;

			// Define outer spawn zone, expanded by padding
			var outer_x1 = inner_x1 - this.padding;
			var outer_y1 = inner_y1 - this.padding;
			var outer_x2 = inner_x2 + this.padding;
			var outer_y2 = inner_y2 + this.padding;

			const side = Math.floor(Math.random() * 4);

			switch (side) {
				case 0: // Top slice
					x = Math.random() * (outer_x2 - outer_x1) + outer_x1;
					y = Math.random() * (inner_y1 - outer_y1) + outer_y1;
					break;
				case 1: // Bottom slice
					x = Math.random() * (outer_x2 - outer_x1) + outer_x1;
					y = Math.random() * (outer_y2 - inner_y2) + inner_y2;
					break;
				case 2: // Left slice
					x = Math.random() * (inner_x1 - outer_x1) + outer_x1;
					y = Math.random() * (inner_y2 - inner_y1) + inner_y1;
					break;
				case 3: // Right slice
					x = Math.random() * (outer_x2 - inner_x2) + inner_x2;
					y = Math.random() * (inner_y2 - inner_y1) + inner_y1;
					break;
			}
			
			// Handle potential NaN results if width/height/spread are invalid
			if (isNaN(x)) x = this.area_x;
			if (isNaN(y)) y = this.area_y;

		} else { // Target object mode
			x = this.target_x;
			y = this.target_y;
		}

		this.pointX = x;
		this.pointY = y;
		this.runtime.trigger(cr.plugins_.SpawnPoint.prototype.cnds.OnSetPoint, this);
	};
	Acts.prototype.SetTargetObject = function (obj) {
		if (!obj) return;
		var inst = obj.getFirstPicked();
		if (!inst) return;
		this.target_uid = inst.uid;
		this.target_x = inst.x;
		this.target_y = inst.y;
	};
	Acts.prototype.ClearTargetObject = function () { this.target_uid = -1; };
	pluginProto.acts = new Acts();
	
	function Exps() {};
	Exps.prototype.PointX = function (ret) { ret.set_float(this.pointX); };
	Exps.prototype.PointY = function (ret) { ret.set_float(this.pointY); };
	pluginProto.exps = new Exps();

}());