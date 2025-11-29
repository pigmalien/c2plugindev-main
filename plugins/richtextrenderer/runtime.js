﻿// ECMAScript 5 strict mode
"use strict";

assert2(cr, "cr namespace not created");
assert2(cr.plugins_, "cr.plugins_ not created");

/////////////////////////////////////
// Plugin class
cr.plugins_.RichTextRenderer = function(runtime)
{
	this.runtime = runtime;
};
(function ()
{
	/////////////////////////////////////
	var pluginProto = cr.plugins_.RichTextRenderer.prototype;
		
	/////////////////////////////////////
	// Object type class
	pluginProto.Type = function(plugin)
	{
		this.plugin = plugin;
		this.runtime = plugin.runtime;
	};
	
	var typeProto = pluginProto.Type.prototype;

	// called on startup for each object type
	typeProto.onCreate = function()
	{
	};

	/////////////////////////////////////
	// Instance class
	pluginProto.Instance = function(type)
	{
		this.type = type;
		this.runtime = type.runtime;
		
		// Text and font properties
		this.fullMarkupText = "";
		this.text = "";
		this.fontName = "Arial";
		this.fontSize = 16;
		this.defaultColor = "rgb(0,0,0)";
		this.hAlign = 0; // 0=left, 1=center, 2=right
		this.vAlign = 0; // 0=top, 1=center, 2=bottom
		this.shakeMagnitude = 0;
		
		// Typewriter state
		this.isTypewriter = false;
		this.typewriterIndex = 0;
		this.typewriterSpeed = 0;
		this.typewriterAccumulator = 0;
		this.typewriter_tokens = []; // For markup-aware typewriter
		this.typewriter_char_count = 0; // Number of visible characters for typewriter
		this.typewriter_wait_timer = 0; // For {wait} tag
		
		// Rendering state
		this.text_changed = true;
		this.canvas = null;
		this.ctx = null;
		this.font_ready = false;
		this.lines = []; // For word wrapping
		this.has_shake_tag = false;
		this.texture = null;
	};
	
	var instanceProto = pluginProto.Instance.prototype;

	// called whenever an instance is created
	instanceProto.onCreate = function()
	{
		// Read properties
		this.fullMarkupText = this.properties[0];
		this.fontName = this.properties[1];
		this.fontSize = this.properties[2];
		var customFonts = this.properties[3];
		this.hAlign = this.properties[4]; // 0=Left, 1=Center, 2=Right
		this.vAlign = this.properties[5]; // 0=Top, 1=Center, 2=Bottom
		this.shakeMagnitude = this.properties[6];
		
		// Initialize text
		this.text = this.fullMarkupText;
		this.has_shake_tag = this.fullMarkupText.includes("{shake");
		
		// In WebGL renderer, tick this object to release memory if not rendered for a while
		if (this.runtime.glwrap)
			this.runtime.tickMe(this);

		// Load custom fonts if specified
		if (customFonts && !cr.plugins_.RichTextRenderer.did_load_fonts)
		{
			var fontList = customFonts.split(",");
			var styleSheet = "";

			for (var i = 0; i < fontList.length; i++)
			{
				var fontName = fontList[i].trim();
				if (fontName)
				{
					// Derive font-family from filename, e.g., "MyCoolFont.ttf" -> "MyCoolFont"
					var fontFamily = fontName.substr(0, fontName.lastIndexOf('.')) || fontName;
					styleSheet += "@font-face {\n" +
								  "font-family: '" + fontFamily + "';\n" +
								  "src: url('" + fontName + "');\n" +
								  "}\n";
				}
			}

			if (styleSheet) {
				var style = document.createElement("style");
				style.type = "text/css";
				style.innerHTML = styleSheet;
				document.head.appendChild(style);
			}
			
			cr.plugins_.RichTextRenderer.did_load_fonts = true; // Use a global flag
		}

		// Use the Font Loading API to wait for the font to be ready
		var self = this;
		if (document.fonts && document.fonts.load)
		{
			document.fonts.load(this.fontSize + "px " + this.fontName).then(function () {
				// Font is loaded, mark as ready.
				// We need to trigger a redraw on the next tick.
				self.font_ready = true;
				self.text_changed = true;
				self.runtime.redraw = true;
			});
		}
		else
		{
			// If the Font Loading API is not supported, assume the font is ready after a short delay.
			this.font_ready = true;
		}
	};
	
	instanceProto.onDestroy = function ()
	{
		// Release the WebGL texture
		if (this.texture)
		{
			this.runtime.glwrap.deleteTexture(this.texture);
			this.texture = null;
		}
	};
	
	instanceProto.tick = function()
	{
		// In WebGL renderer, if not rendered for 5 seconds, free the texture
		if (this.runtime.glwrap && this.texture && (this.runtime.tickcount - this.last_render_tick >= 300))
		{
			var layer = this.layer;
            this.update_bbox();
            var bbox = this.bbox;

            if (bbox.right < layer.viewLeft || bbox.bottom < layer.viewTop || bbox.left > layer.viewRight || bbox.top > layer.viewBottom)
			{
				this.runtime.glwrap.deleteTexture(this.texture);
				this.texture = null;
			}
		}
		
		// If text has a shake tag, it needs to be redrawn every frame for the animation.
		if (this.has_shake_tag)
		{
			this.text_changed = true;
			this.runtime.redraw = true;
		}
		
		// Handle typewriter effect
		if (this.isTypewriter)
		{
			var dt = this.runtime.getDt(this);

			// If waiting, just count down the timer and do nothing else
			if (this.typewriter_wait_timer > 0)
			{
				this.typewriter_wait_timer -= dt * 1000; // dt is in seconds, timer is in ms
				return;
			}

			var dt = this.runtime.getDt(this);
			this.typewriterAccumulator += dt * this.typewriterSpeed;
			
			var charsToReveal = Math.floor(this.typewriterAccumulator);
			if (charsToReveal >= 1)
			{
				this.typewriterAccumulator -= charsToReveal;
				this.typewriterIndex += charsToReveal;
				
				if (this.typewriterIndex >= this.typewriter_char_count)
				{
					// Typewriter finished
					this.typewriterIndex = this.typewriter_char_count;
					this.text = this.originalMarkupText; // Restore the original full markup text
					this.fullMarkupText = this.originalMarkupText; // Sync the canonical text state
					this.isTypewriter = false;
					this.runtime.trigger(pluginProto.cnds.OnTypewriterFinished, this);
				}
				else
				{
					// Reconstruct the visible text from the tokens
					var new_text = "";
					var chars_to_render = this.typewriterIndex;
					for(var i = 0; i < this.typewriter_tokens.length; i++)
					{						
						var token = this.typewriter_tokens[i];
						if (token.type === "tag")
						{
							// Check for a wait tag if we have just revealed the character before it
							if (chars_to_render === 0 && token.text.startsWith("{wait:"))
							{
								var waitTime = parseInt(token.text.substring(6, token.text.length - 1), 10);
								if (!isNaN(waitTime) && waitTime > 0)
								{
									this.typewriter_wait_timer = waitTime;
								}
							}
							// Check for a skip tag
							else if (token.text === "{skip}")
							{
								// Typewriter finished by skip tag
								this.typewriterIndex = this.typewriter_char_count;
								this.text = this.originalMarkupText; // Set the final text
								this.fullMarkupText = this.originalMarkupText; // Sync canonical state
								this.isTypewriter = false;
								this.text_changed = true; // Flag for redraw
								this.runtime.redraw = true;
								this.runtime.trigger(pluginProto.cnds.OnTypewriterFinished, this);
								return; // Exit the tick function immediately
							}
							new_text += token.text;
						}
						else // char
						{
							if (chars_to_render > 0)
							{
								chars_to_render--;
								new_text += token.text;
							}
							else
								break; // Stop processing further tokens
						}
					}
					this.text = new_text;
				}
				
				this.text_changed = true;
				this.runtime.redraw = true;
			}
		}
		else
		{
			// If not typing, ensure the visible text is always the full text
			if (this.text !== this.fullMarkupText)
				this.text = this.fullMarkupText;
		}
	};
	
	instanceProto.update_texture = function ()
	{
		// Do not attempt to draw until the font is confirmed to be loaded.
		if (!this.font_ready)
			return;

		this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
		
		this.ctx.font = this.fontSize + "px " + this.fontName;
		this.ctx.fillStyle = this.defaultColor;
		
		// Handle alignment
		if (this.hAlign === 1) // Center
			this.ctx.textAlign = "center";
		else if (this.hAlign === 2) // Right
			this.ctx.textAlign = "right";
		else // Left
			this.ctx.textAlign = "left";
			
		if (this.vAlign === 1) // Center
			this.ctx.textBaseline = "middle";
		else if (this.vAlign === 2) // Bottom
			this.ctx.textBaseline = "bottom";
		else // Top
			this.ctx.textBaseline = "top";
			
		var x = (this.hAlign === 1) ? this.canvas.width / 2 : (this.hAlign === 2) ? this.canvas.width : 0;
		var y = (this.vAlign === 1) ? this.canvas.height / 2 : (this.vAlign === 2) ? this.canvas.height : 0;

		// Word wrap the text and then draw the resulting lines
		this.word_wrap_text(this.ctx, this.text, this.lines, this.canvas.width);
		this.draw_wrapped_text(this.ctx, this.lines, x, y);
	};

	instanceProto.apply_shake = function(ctx, x, y, part, magnitude)
	{
		var shakeX = (Math.random() - 0.5) * magnitude * 2;
		var shakeY = (Math.random() - 0.5) * magnitude * 2;
		ctx.fillText(part, x + shakeX, y + shakeY);
	};

	var wordsCache = [];
	var tagsRegex = /({[^}]+})/g;

	// Tokenise text into words and tags
	instanceProto.tokeniseText = function (text)
	{
		cr.clearArray(wordsCache);
		var parts = text.split(tagsRegex);
		
		for (var i = 0; i < parts.length; i++)
		{
			var part = parts[i];
			if (!part) continue;

			if (i % 2 === 1) { // This is a tag
				wordsCache.push({type: "tag", text: part});
			}
			else { // This is plain text, break it into words
				var cur_word = "";
				var ch;
				var j = 0;
				while (j < part.length)
				{
					ch = part.charAt(j);
					if (ch === " " || ch === "\t" || ch === "\n" || ch === "-")
					{
						if (cur_word.length)
							wordsCache.push({type: "word", text: cur_word});
						cur_word = "";
						
						do {
							cur_word += part.charAt(j);
							j++;
						}
						while (j < part.length && (part.charAt(j) === " " || part.charAt(j) === "\t"));
						
						wordsCache.push({type: "word", text: cur_word});
						cur_word = "";
					}
					else
					{
						cur_word += ch;
						j++;
					}
				}
				if (cur_word.length)
					wordsCache.push({type: "word", text: cur_word});
			}
		}
	};

	// Markup-aware word wrapping
	instanceProto.word_wrap_text = function (ctx, text, lines, width)
	{
		if (!text || !text.length) {
			cr.clearArray(lines);
			return;
		}

		if (width <= 2.0) {
			cr.clearArray(lines);
			return;
		}

		this.tokeniseText(text);
		var wordArray = wordsCache;

		var cur_line = "";
		var line_width = 0;
		var fontStateStack = [];
		var currentFontSize = this.fontSize;
		var isBold = false;
		var isItalic = false;
		
		cr.clearArray(lines);

		for (var i = 0; i < wordArray.length; i++)
		{
			var token = wordArray[i];
			var tokenText = token.text;

			if (token.type === "tag") {
				cur_line += tokenText;
				// Apply tag state changes for future measurements
				var tagName = tokenText.substring(1, tokenText.length - 1);
				if (tagName.startsWith("size:")) { fontStateStack.push({type:"size", value:currentFontSize}); currentFontSize = parseInt(tagName.substring(5),10); }
				else if (tagName === "b") { fontStateStack.push({type:"b", value:isBold}); isBold = true; }
				else if (tagName === "i") { fontStateStack.push({type:"i", value:isItalic}); isItalic = true; }
				else if (tagName.startsWith("/")) {
					if (fontStateStack.length > 0) {
						var lastState = fontStateStack.pop();
						if (lastState.type === "size") currentFontSize = lastState.value;
						if (lastState.type === "b") isBold = lastState.value;
						if (lastState.type === "i") isItalic = lastState.value;
					}
				}
			}
			else { // Word token
				var fontStyle = (isItalic ? "italic " : "") + (isBold ? "bold " : "") + currentFontSize + "px " + this.fontName;
				ctx.font = fontStyle;
				var word_width = ctx.measureText(tokenText).width;

				if (line_width + word_width > width && cur_line.length > 0) {
					lines.push(cur_line);
					cur_line = tokenText;
					line_width = word_width;
				}
				else {
					cur_line += tokenText;
					line_width += word_width;
				}
			}
		}

		if (cur_line.length) {
			lines.push(cur_line);
		}
	};

	instanceProto.draw_wrapped_text = function(ctx, lines, x, y)
	{
		var line_height = this.fontSize + 2; // A simple default line height
		var total_height = lines.length * line_height;
		var startY = y;

		if (this.vAlign === 1) startY = y - (total_height / 2);
		else if (this.vAlign === 2) startY = y - total_height;

		for (var i = 0; i < lines.length; i++) {
			this.draw_text_with_markup(ctx, lines[i], x, startY + (i * line_height));
		}
	};

	// Simple markup parser and renderer
	instanceProto.draw_text_with_markup = function(ctx, text, x, y)
	{
		var originalFillStyle = this.defaultColor;
		var currentFillStyle = this.defaultColor;
		var currentFontSize = this.fontSize;
		var isBold = false;
		var originalFontSize = this.fontSize;
		var isItalic = false;
		var currentShakeMagnitude = 0; // 0 means not shaking
		
		// Regular expression to find tags like {color:red} or {/color}
		var tagRegex = /({[^}]+})/g;
		var parts = text.split(tagRegex);

		// Keep a stack for nested tags, e.g. {size:24}Hello {color:red}World{/color}{/size}
		var fontStateStack = [];
		
		var currentX = x;
		
		// Adjust starting X for centered or right-aligned text
		if (ctx.textAlign === "center" || ctx.textAlign === "right")
		{
			var totalWidth = 0;
			// First, measure the total width of the rendered text without tags
			var tempFontSize = this.fontSize;
			var tempIsBold = false;
			var tempIsItalic = false;
			var tempShakeMagnitude = 0; // No need for tempIsShaking, as it doesn't affect measurement

			for (var i = 0; i < parts.length; i++) {
				var part = parts[i];
				if (i % 2 === 0) { // Even indices are text
					var fontStyle = (tempIsItalic ? "italic " : "") + (tempIsBold ? "bold " : "") + tempFontSize + "px " + this.fontName;
					ctx.font = fontStyle;
					totalWidth += ctx.measureText(parts[i]).width;
				}
				else { // Tag
					var tagName = part.substring(1, part.length - 1);
					if (tagName.startsWith("size:")) {
						fontStateStack.push({type: "size", value: tempFontSize});
						tempFontSize = parseInt(tagName.substring(5), 10);
					} else if (tagName === "b") {
						fontStateStack.push({type: "b", value: tempIsBold});
						tempIsBold = true;
					} else if (tagName === "i") {
						fontStateStack.push({type: "i", value: tempIsItalic});
						tempIsItalic = true;
					} else if (tagName === "shake") { // Default shake
						fontStateStack.push({type: "shake", value: tempShakeMagnitude});
						tempShakeMagnitude = this.shakeMagnitude;
					} else if (tagName.startsWith("shake:")) { // Shake with value
						fontStateStack.push({type: "shake", value: tempShakeMagnitude});
						tempShakeMagnitude = parseInt(tagName.substring(6), 10);
						if (isNaN(tempShakeMagnitude) || tempShakeMagnitude < 0) tempShakeMagnitude = 0;
					} else if (tagName.startsWith("/")) {
						var closeType = tagName.substring(1);
						if (fontStateStack.length > 0) {
							var lastState = fontStateStack.pop();
							// Simple pop assumes correctly nested tags.
							if (lastState.type === "size") tempFontSize = lastState.value;
							if (lastState.type === "color") { /* color doesn't affect measurement */ }
							if (lastState.type === "b") tempIsBold = lastState.value;
							if (lastState.type === "i") tempIsItalic = lastState.value;
							if (lastState.type === "shake") tempShakeMagnitude = lastState.value;
						}
					}
					// Fallback for unclosed tags if stack is empty
					if (fontStateStack.length === 0) {
						tempFontSize = this.fontSize;
						tempIsBold = false;
						tempIsItalic = false;
						tempShakeMagnitude = 0;
					}
				}
			}
			if (ctx.textAlign === "center")
				currentX = x - (totalWidth / 2);
			else // right
				currentX = x - totalWidth;
		}
		
		// Reset for actual drawing
		fontStateStack = [];

		for (var i = 0; i < parts.length; i++)
		{
			var part = parts[i];
			if (i % 2 === 0) { // This is plain text
				var fontStyle = (isItalic ? "italic " : "") + (isBold ? "bold " : "") + currentFontSize + "px " + this.fontName;
				ctx.font = fontStyle;
				ctx.fillStyle = currentFillStyle;
				if (currentShakeMagnitude > 0) {
					this.apply_shake(ctx, currentX, y, part, currentShakeMagnitude); // Pass magnitude
				}
				else {
					ctx.fillText(part, currentX, y); // Removed the incorrect 'part' argument
				}
				currentX += ctx.measureText(part).width;
			} else { // This is a tag
				var tagName = part.substring(1, part.length - 1);
				if (tagName.startsWith("color:")) {
					fontStateStack.push({type: "color", value: currentFillStyle});
					currentFillStyle = tagName.substring(6);
				} else if (tagName.startsWith("size:")) {
					fontStateStack.push({type: "size", value: currentFontSize});
					currentFontSize = parseInt(tagName.substring(5), 10);
					if (isNaN(currentFontSize) || currentFontSize <= 0) {
						currentFontSize = originalFontSize;
					}
				} else if (tagName === "b") {
					fontStateStack.push({type: "b", value: isBold});
					isBold = true;
				} else if (tagName === "i") {
					fontStateStack.push({type: "i", value: isItalic});
					isItalic = true;
				} else if (tagName === "shake") { // Default shake
					fontStateStack.push({type: "shake", value: currentShakeMagnitude});
					currentShakeMagnitude = this.shakeMagnitude;
				} else if (tagName.startsWith("shake:")) { // Shake with value
					fontStateStack.push({type: "shake", value: currentShakeMagnitude});
					currentShakeMagnitude = parseInt(tagName.substring(6), 10);
					if (isNaN(currentShakeMagnitude) || currentShakeMagnitude < 0) currentShakeMagnitude = 0;
				} else if (tagName.startsWith("/")) { // Generic closing tag
					if (fontStateStack.length > 0) {
						var lastState = fontStateStack.pop();
						if (lastState.type === "color") currentFillStyle = lastState.value;
						if (lastState.type === "size") currentFontSize = lastState.value;
						if (lastState.type === "b") isBold = lastState.value;
						if (lastState.type === "i") isItalic = lastState.value;
						if (lastState.type === "shake") currentShakeMagnitude = lastState.value;
					}
				}

				// Fallback for unclosed tags
				if (fontStateStack.length === 0) {
					currentFillStyle = originalFillStyle;
					currentFontSize = originalFontSize;
					isBold = false;
					isItalic = false;
					currentShakeMagnitude = 0;
				}

				// Other tags like {size}, {font}, {/size} etc. would be handled here
			}
		}
	};
	
	instanceProto.saveToJSON = function ()
	{
		return {
			"ft": this.fullMarkupText,
			"t": this.text,
			"fn": this.fontName,
			"fs": this.fontSize,
			"c": this.defaultColor,
			"ha": this.hAlign,
			"va": this.vAlign,
			"it": this.isTypewriter,
			"ti": this.typewriterIndex,
			"ts": this.typewriterSpeed,
			"ta": this.typewriterAccumulator,
			"omt": this.originalMarkupText,
			"twt": this.typewriter_wait_timer,
			"sm": this.shakeMagnitude
			// typewriter_tokens can be rebuilt, no need to save
			// lines can be rebuilt
		};
	};
	
	instanceProto.loadFromJSON = function (o)
	{
		this.fullMarkupText = o["ft"];
		this.text = o["t"];
		this.fontName = o["fn"];
		this.fontSize = o["fs"];
		this.defaultColor = o["c"];
		this.hAlign = o["ha"];
		this.vAlign = o["va"];
		this.isTypewriter = o["it"];
		this.typewriterIndex = o["ti"];
		this.typewriterSpeed = o["ts"];
		this.typewriterAccumulator = o["ta"];
		this.originalMarkupText = o["omt"];
		this.typewriter_wait_timer = o["twt"] || 0;
		this.shakeMagnitude = o["sm"] || 0;
		this.font_ready = true; // Assume font is ready on load
		
		this.has_shake_tag = this.fullMarkupText.includes("{shake");
		this.text_changed = true;
	};
	
	instanceProto.draw = function(ctx)
	{
		// Canvas2D renderer fallback
		// For simplicity, we delegate to the WebGL drawing function,
		// as the glwrap object can handle drawing to a 2D context.
		this.drawGL(this.runtime.glwrap);
	};
	
	instanceProto.drawGL = function (glw)
	{
		if (this.width < 1 || this.height < 1)
			return;
			
		var need_redraw = this.text_changed;

		var layer_scale = this.layer.getScale();
		var scaledwidth = Math.ceil(this.width * layer_scale);
		var scaledheight = Math.ceil(this.height * layer_scale);

		// Lazy canvas creation and resizing
		if (!this.canvas || this.canvas.width !== scaledwidth || this.canvas.height !== scaledheight)
		{
			if(this.canvas)
			{
				// Resizing, so release old texture
				if (this.texture)
				{
					glw.deleteTexture(this.texture);
					this.texture = null;
				}
			}
			else
			{
				this.canvas = document.createElement("canvas");
				this.ctx = this.canvas.getContext("2d");
			}

			this.canvas.width = scaledwidth;
			this.canvas.height = scaledheight;
			need_redraw = true;
		}

		if (need_redraw)
		{
			// Only update the texture if the font is ready. If it's not, the font loader's
			// .then() callback will set text_changed and trigger this block on a future tick.
			if (this.font_ready) {
				this.update_texture();

				if (!this.texture)
					this.texture = glw.createEmptyTexture(scaledwidth, scaledheight, this.runtime.linearSampling, false);

				glw.videoToTexture(this.canvas, this.texture);
				
				this.text_changed = false;
			}
		}

		if (!this.texture)
			return;
			
		glw.setTexture(this.texture);
		glw.setOpacity(this.opacity);
		
		var q = this.bquad;
		glw.quad(q.tlx, q.tly, q.trx, q.try_, q.brx, q.bry, q.blx, q.bly);
		
		this.last_render_tick = this.runtime.tickcount;
	};

	//////////////////////////////////////
	// Conditions
	function Cnds() {};

	Cnds.prototype.IsTypewriterActive = function ()
	{
		return this.isTypewriter;
	};
	
	Cnds.prototype.OnTypewriterFinished = function ()
	{
		return true;
	};
	
	pluginProto.cnds = new Cnds();
	
	//////////////////////////////////////
	// Actions
	function Acts() {};

	Acts.prototype.SetText = function (text)
	{
		if (this.fullMarkupText !== text)
		{
			this.fullMarkupText = text;
			this.text = text;
			this.isTypewriter = false;
			this.has_shake_tag = this.fullMarkupText.includes("{shake");
			this.text_changed = true;
			this.runtime.redraw = true;
		}
	};

	Acts.prototype.BeginTypewriter = function (text, speed)
	{
		// Tokenize the text for the typewriter
		this.typewriter_tokens = [];
		var tagRegex = /({[^}]+})/g;
		var parts = text.split(tagRegex);
		this.typewriter_char_count = 0;

		for (var i = 0; i < parts.length; i++)
		{
			var part = parts[i];
			if (!part) continue;

			if (i % 2 === 0) { // This is plain text
				for (var j = 0; j < part.length; j++) {
					this.typewriter_tokens.push({ type: "char", text: part[j] });
				}
				this.typewriter_char_count += part.length;
			} else { // This is a tag
				this.typewriter_tokens.push({ type: "tag", text: part });
			}
		}

		this.originalMarkupText = text; // Store the original markup string
		this.has_shake_tag = this.originalMarkupText.includes("{shake");
		this.typewriterSpeed = speed;
		
		this.isTypewriter = true;
		this.typewriterIndex = 0;
		this.typewriterAccumulator = 0;
		this.typewriter_wait_timer = 0;
		this.text = "";
		this.text_changed = true;
		this.runtime.redraw = true;
	};

	Acts.prototype.SetDefaultFont = function (fontName, fontSize)
	{
		this.fontName = fontName;
		this.fontSize = fontSize;
		if (this.fontSize < 1) this.fontSize = 1;

		// When changing font at runtime, we must again wait for it to be loaded.
		var self = this;
		if (document.fonts && document.fonts.load)
		{
			// Mark font as not ready and trigger the load.
			this.font_ready = false;
			document.fonts.load(this.fontSize + "px " + this.fontName).then(function () {
				// Font is now loaded, mark as ready and trigger a redraw.
				self.font_ready = true;
				self.text_changed = true;
				self.runtime.redraw = true;
			});
		}
		
		this.text_changed = true;
		this.runtime.redraw = true;
	};
	
	Acts.prototype.SetTypewriterSpeed = function (speed)
	{
		this.typewriterSpeed = speed;
	};
	
	pluginProto.acts = new Acts();
	
	//////////////////////////////////////
	// Expressions
	function Exps() {};
	
	Exps.prototype.Text = function (ret)
	{
		ret.set_string(this.fullMarkupText);
	};
	
	Exps.prototype.TypewriterSpeed = function (ret)
	{
		ret.set_number(this.typewriterSpeed);
	};
	
	pluginProto.exps = new Exps();

}());