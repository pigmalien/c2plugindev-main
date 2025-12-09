// ECMAScript 5 strict mode
"use strict";

assert2(cr, "cr namespace not created");
assert2(cr.plugins_, "cr.plugins_ not created");

/////////////////////////////////////
// Plugin class
cr.plugins_.ItchIO = function (runtime) {
	this.runtime = runtime;
};

(function () {
	var pluginProto = cr.plugins_.ItchIO.prototype;

	/////////////////////////////////////
	// Object type class
	pluginProto.Type = function (plugin) {
		this.plugin = plugin;
		this.runtime = plugin.runtime;
	};

	var typeProto = pluginProto.Type.prototype;

	typeProto.onCreate = function () {
	};

	/////////////////////////////////////
	// Instance class
	pluginProto.Instance = function (type) {
		this.type = type;
		this.runtime = type.runtime;

		this.apiKey = "";
		this.userData = null;
		this.lastError = "";
		this.lastData = "";

		this.isNode = false;
	};

	var instanceProto = pluginProto.Instance.prototype;

	instanceProto.onCreate = function () {
		// properties
		this.keySource = this.properties[0]; // 0 = Env, 1 = Manual
		this.manualKey = this.properties[1];

		// Check environment for Node.js / NW.js
		if (typeof process !== "undefined" && typeof require === "function") {
			this.isNode = true;
		} else {
			this.isNode = false;
			// Warn in browser console
			if (window.console && console.warn) {
				console.warn("[Itch.io Plugin] You are running in a Browser environment. Direct API requests will likely fail due to CORS. Please test using 'Preview in Node-Webkit' or export to NW.js.");
			}
		}
	};

	instanceProto.saveToJSON = function () {
		return {
			"apiKey": this.apiKey,
			"userData": this.userData
		};
	};

	instanceProto.loadFromJSON = function (o) {
		this.apiKey = o["apiKey"];
		this.userData = o["userData"];
	};

	instanceProto.draw = function (ctx) {
	};

	instanceProto.drawGL = function (glw) {
	};

	/**BEGIN-PREVIEWONLY**/
	instanceProto.getDebuggerValues = function (propsections) {
		propsections.push({
			"title": "Itch.io",
			"properties": [
				{ "name": "API Key", "value": this.apiKey ? (this.apiKey.substring(0, 4) + "...") : "None", "readonly": true },
				{ "name": "Username", "value": this.userData ? this.userData["username"] : "", "readonly": true },
				{ "name": "Last Error", "value": this.lastError, "readonly": true },
				{ "name": "Mode", "value": this.isNode ? "Node/NW.js (CORS Bypassed)" : "Browser (CORS Restricted)", "readonly": true }
			]
		});
	};
	/**END-PREVIEWONLY**/

	// Internal request helper
	instanceProto._makeRequest = function (urlStr, callback) {
		var self = this;

		if (this.isNode) {
			try {
				var https = require('https');
				var urlModule = require('url');
				var options = urlModule.parse(urlStr);

				// Add Authorization header
				if (this.apiKey) {
					if (!options.headers) options.headers = {};
					options.headers['Authorization'] = this.apiKey;
				}

				var req = https.get(options, function (res) {
					var rawData = '';
					res.setEncoding('utf8');

					res.on('data', function (chunk) {
						rawData += chunk;
					});

					res.on('end', function () {
						if (res.statusCode >= 200 && res.statusCode < 300) {
							try {
								var parsedData = JSON.parse(rawData);
								callback(null, parsedData);
							} catch (e) {
								callback(e.message, null);
							}
						} else {
							callback("HTTP Error: " + res.statusCode + " " + rawData, null);
						}
					});
				});

				req.on('error', function (e) {
					callback(e.message, null);
				});

				req.end();

			} catch (e) {
				callback("Node require failed: " + e.message, null);
			}
		} else {
			// Browser Mode
			jQuery.ajax({
				url: urlStr,
				dataType: "json",
				beforeSend: function (xhr) {
					if (self.apiKey) {
						xhr.setRequestHeader("Authorization", self.apiKey);
					}
				},
				success: function (data) {
					callback(null, data);
				},
				error: function (xhr, status, error) {
					var msg = error || status;
					if (xhr.status === 0) msg += " (Poss. CORS)";
					callback(msg, null);
				}
			});
		}
	};

	//////////////////////////////////////
	// Conditions
	function Cnds() { };

	Cnds.prototype.OnLoginSuccess = function () { return true; };
	Cnds.prototype.OnLoginError = function () { return true; };

	Cnds.prototype.IsLoggedIn = function () { return !!this.apiKey; };

	Cnds.prototype.OnProfileReceived = function () { return true; };
	Cnds.prototype.OnDataError = function () { return true; };

	Cnds.prototype.OnMyGamesReceived = function () { return true; };
	Cnds.prototype.OnPurchaseChecked = function () { return true; };
	Cnds.prototype.IsOwned = function () { return this.isOwned; };

	pluginProto.cnds = new Cnds();

	//////////////////////////////////////
	// Actions
	function Acts() { };

	Acts.prototype.Login = function () {
		var foundKey = "";

		// 0 = Environment Variable
		if (this.keySource === 0) {
			if (this.isNode && process.env) {
				if (process.env["ITCHIO_API_KEY"]) {
					foundKey = process.env["ITCHIO_API_KEY"];
				}
			}
		}

		// Fallback or explicit Manual
		if (!foundKey && (this.keySource === 1 || this.keySource === 0)) {
			if (this.manualKey && this.manualKey.length > 0) {
				foundKey = this.manualKey;
			}
		}

		if (foundKey) {
			this.apiKey = foundKey;
			this.runtime.trigger(cr.plugins_.ItchIO.prototype.cnds.OnLoginSuccess, this);
		} else {
			this.lastError = "No API Key found.";
			if (this.keySource === 0 && !this.isNode) {
				this.lastError += " (Env vars unavailable in Browser)";
			}
			this.runtime.trigger(cr.plugins_.ItchIO.prototype.cnds.OnLoginError, this);
		}
	};

	Acts.prototype.SetAPIKey = function (key) {
		this.apiKey = key;
	};

	Acts.prototype.RequestProfile = function () {
		if (!this.apiKey) {
			this.lastError = "Not logged in.";
			this.runtime.trigger(cr.plugins_.ItchIO.prototype.cnds.OnDataError, this);
			return;
		}

		// URL without api_key param
		var url = "https://itch.io/api/1/key/me";
		var self = this;

		this._makeRequest(url, function (err, data) {
			if (err) {
				self.lastError = err;
				self.runtime.trigger(cr.plugins_.ItchIO.prototype.cnds.OnDataError, self);
			} else {
				if (data && data["user"]) {
					self.userData = data["user"];
					self.lastData = JSON.stringify(data);
					self.runtime.trigger(cr.plugins_.ItchIO.prototype.cnds.OnProfileReceived, self);
				} else {
					self.lastError = "Invalid response: " + JSON.stringify(data);
					self.runtime.trigger(cr.plugins_.ItchIO.prototype.cnds.OnDataError, self);
				}
			}
		});
	};

	Acts.prototype.GenericRequest = function (endpoint) {
		if (!this.apiKey) {
			this.lastError = "Not logged in.";
			this.runtime.trigger(cr.plugins_.ItchIO.prototype.cnds.OnDataError, this);
			return;
		}

		// clean endpoint
		if (endpoint.indexOf("/") === 0) endpoint = endpoint.substring(1);

		var url = "https://itch.io/api/1/key/" + endpoint;
		// Removed api_key param appending

		var self = this;

		this._makeRequest(url, function (err, data) {
			if (err) {
				self.lastError = err;
				self.runtime.trigger(cr.plugins_.ItchIO.prototype.cnds.OnDataError, self);
			} else {
				self.lastData = JSON.stringify(data);
				self.runtime.trigger(cr.plugins_.ItchIO.prototype.cnds.OnProfileReceived, self);
			}
		});
	};

	Acts.prototype.RequestMyGames = function () {
		if (!this.apiKey) {
			this.lastError = "Not logged in.";
			this.runtime.trigger(cr.plugins_.ItchIO.prototype.cnds.OnDataError, this);
			return;
		}

		var url = "https://itch.io/api/1/key/my-games";
		var self = this;

		this._makeRequest(url, function (err, data) {
			if (err) {
				self.lastError = err;
				self.runtime.trigger(cr.plugins_.ItchIO.prototype.cnds.OnDataError, self);
			} else {
				if (data && data["games"]) {
					self.myGames = data["games"];
					self.lastData = JSON.stringify(data);
					self.runtime.trigger(cr.plugins_.ItchIO.prototype.cnds.OnMyGamesReceived, self);
				} else {
					self.lastError = "Invalid games response: " + JSON.stringify(data);
					self.runtime.trigger(cr.plugins_.ItchIO.prototype.cnds.OnDataError, self);
				}
			}
		});
	};

	Acts.prototype.CheckOwnership = function (gameId) {
		if (!this.apiKey) {
			this.lastError = "Not logged in.";
			this.runtime.trigger(cr.plugins_.ItchIO.prototype.cnds.OnDataError, this);
			return;
		}

		if (!this.userData || !this.userData["id"]) {
			this.lastError = "Profile not loaded. Call Request Profile first.";
			this.runtime.trigger(cr.plugins_.ItchIO.prototype.cnds.OnDataError, this);
			return;
		}

		var userId = this.userData["id"];
		var url = "https://itch.io/api/1/key/game/" + gameId + "/download_keys?user_id=" + userId;

		var self = this;

		this._makeRequest(url, function (err, data) {
			if (err) {
				self.lastError = err;
				self.isOwned = false;
				self.runtime.trigger(cr.plugins_.ItchIO.prototype.cnds.OnPurchaseChecked, self); // Should we fail here or just say check complete?
				// Error usually means network fail or auth fail. If user just doesn't own it, it returns valid JSON with empty keys?
				// Actually api errors return 200 with errors object sometimes, or 4xx.
				// For now trigger DataError on network/auth fail.
				self.runtime.trigger(cr.plugins_.ItchIO.prototype.cnds.OnDataError, self);
			} else {
				self.lastData = JSON.stringify(data);
				// Response should have "download_keys" array
				if (data && data["download_keys"] && data["download_keys"].length > 0) {
					self.isOwned = true;
				} else {
					self.isOwned = false;
				}
				self.runtime.trigger(cr.plugins_.ItchIO.prototype.cnds.OnPurchaseChecked, self);
			}
		});
	};

	pluginProto.acts = new Acts();

	//////////////////////////////////////
	// Expressions
	function Exps() { };

	Exps.prototype.APIKey = function (ret) {
		ret.set_string(this.apiKey);
	};

	Exps.prototype.Username = function (ret) {
		ret.set_string(this.userData ? (this.userData["username"] || "") : "");
	};

	Exps.prototype.UserID = function (ret) {
		ret.set_int(this.userData ? (this.userData["id"] || 0) : 0);
	};

	Exps.prototype.ProfileURL = function (ret) {
		ret.set_string(this.userData ? (this.userData["url"] || "") : "");
	};

	Exps.prototype.LastError = function (ret) {
		ret.set_string(this.lastError || "");
	};

	Exps.prototype.LastData = function (ret) {
		ret.set_string(this.lastData || "");
	};

	Exps.prototype.GameCount = function (ret) {
		ret.set_int(this.myGames ? this.myGames.length : 0);
	};

	Exps.prototype.GameTitle = function (ret, index) {
		index = Math.floor(index);
		if (this.myGames && index >= 0 && index < this.myGames.length)
			ret.set_string(this.myGames[index]["title"] || "");
		else
			ret.set_string("");
	};

	Exps.prototype.GameID = function (ret, index) {
		index = Math.floor(index);
		if (this.myGames && index >= 0 && index < this.myGames.length)
			ret.set_int(this.myGames[index]["id"] || 0);
		else
			ret.set_int(0);
	};

	Exps.prototype.IsOwnedValue = function (ret) {
		ret.set_int(this.isOwned ? 1 : 0);
	};

	pluginProto.exps = new Exps();

}());