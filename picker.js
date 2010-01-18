var Picker = function(options)
{
	var m_date     = options ? options.date : new Date();
	var m_day      = m_date == null ? (options ? options.day : 0) : m_date.getDay();
	var days       = ['--', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
	var me         = this;
	var m_selected = null;
	var m_anim_callback = options ? options.anim_callback : null;
	var m_closed   = options ? options.closed : null;

	this.show = function(elem, callback)
	{
		this.callback = callback;

		var picker = document.createElement('div');
		picker.setAttribute('class', 'picker');
		picker.setAttribute('id', 'picker');

		for (var i = 0; i < days.length; i++) {
			var day = document.createElement('input');
			day.setAttribute('class', 'picker');
			day.setAttribute('type', 'button');
			day.setAttribute('value', days[i]);
			day.setAttribute('id', 'picker_' + i);
			if (m_day + 1 == i)
				day.setAttribute('class', 'picker sel');

			$(day).click(function(e) { me.select_day(e); });
			picker.appendChild(day);
		}

		var dp = document.createElement('input');
		dp.setAttribute('type', 'button');
		dp.setAttribute('class', m_date ? 'picker sel' : 'picker');
		dp.setAttribute('value', 'Pick ->');
		dp.setAttribute('id', 'picker_pick');
		$(dp).datepicker({ buttonText: 'Pick', onSelect: this.select_date, defaultDate: m_date, dateFormat: 'yy-mm-dd' });
		dp.onclick = function() {
			$('#picker_pick').datepicker('show');
		}
		picker.appendChild(dp);

		$(picker).hide();

		document.body.appendChild(picker);
		$(picker).css(elem.position());
		$(picker).slideDown('fast', m_anim_callback);

		// Add mouseover/mouseout handlers
		$('input.picker').mouseover(function(e) { me.highlight($(this)); });
		$('input.picker').mouseout(function(e) { me.unhighlight($(this)); });

		// Add keyboard handler
		if ('addEventListener' in window)
			window.addEventListener('keydown', this.keyboard, true);
		else if ('attachEvent' in window)
			document.attachEvent('onkeydown', this.keyboard);
		else
			window.onkeydown = this.keyboard;
	};

	this.highlight = function(elem)
	{
		me.unhighlight();
		if (elem && elem.attr('id')) {
			m_selected = elem.attr('id').replace(/picker_/, '');
			elem.addClass('hover');
		}
	};

	this.unhighlight = function(elem)
	{
		m_selected = null;
		$('input.hover').removeClass('hover');
	};

	this.keyboard = function(event)
	{
		event = (event) ? event : ((window.event) ? event : null);

		if (event) {
			var key  = (event.charCode) ? event.charCode : ((event.which) ? event.which : event.keyCode);
			var char = String.fromCharCode(key).toLowerCase();

			var stop = false;

			switch (key) {
				/* Escape key: close whole dropdown */
				case 27:
					me.hide();
					stop = true;
					break;

				/* Enter key: Submit current selection, if any */
				case 13:
					if (m_selected)
						$('#picker_' + m_selected).click();
					stop = true;
					break;

				/* Up arrow: Move selection one element higher (wraps) */
				case 38: // Up arrow
					var sel;
					if (m_selected == null)
						sel = 0;
					else if (m_selected == 'pick')
						sel = 7;
					else {
						sel = parseInt(m_selected) - 1;
						if (sel == -1)
							sel = 'pick';
					}
					if (m_selected)
						me.unhighlight($('#picker_' + m_selected));
					me.highlight($('#picker_' + sel));
					stop = true;
					break;

				/* Down arrow: Move selection one element lower (wraps) */
				case 40:
					var sel;
					if (m_selected == null || m_selected == 'pick')
						sel = 0;
					else {
						sel = parseInt(m_selected) + 1;
						if (sel == 8)
							sel = 'pick';
					}
					if (m_selected)
						me.unhighlight($('#picker_' + m_selected));
					me.highlight($('#picker_' + sel));
					stop = true;
					break;

				/* Right arrow: If 'Pick ->' element is selected, show datepicker control */
				case 39:
					// Check if the datepicker entry is selected
					if (m_selected != 'pick')
						break;
					$('#picker_pick').datepicker('show');
					stop = true;
					break;

				/* Other key: Check if it matches an accelerator key */
				default:
					/*
					  Use character codes instead of ASCII characters because the minus sign (-)
					  generates a code that ends up in the range of lowercase letters in ASCII.
						(Todo #2002)
					*/
					var keys = [
						109, /* '-' */
						83,  /* 'S' */
						77,  /* 'M' */
						84,  /* 'T' */
						87,  /* 'W' */
						72,  /* 'H' */
						70,  /* 'F' */
						65   /* 'A' */
					];
					var pos = keys.indexOf(key);
					if (pos != -1) {
						var button = document.getElementById('picker_' + pos);
						if (button) button.click();
						stop = true;
					}
			}
		}

		if (stop) {
			if ('stopPropagation' in event)
				event.stopPropagation();
			if ('preventDefault' in event)
				event.preventDefault();
			return false;
		}
		return true;
	};

	this.select_day = function(e)
	{
		var elem = e.currentTarget;
		var day  = parseInt(elem.id.replace('picker_', '')) - 1;

		me.hide();		

		me.callback(day);
	};

	this.select_date = function(date_str, inst)
	{
		me.hide();

		me.callback(undefined, date_str);
	}

	this.hide = function()
	{
		var elem = document.getElementById('picker');
		if (elem) {
			$('#picker_pick').datepicker('hide');
			$(elem).slideUp(250, function() { if (elem && elem.parentNode) elem.parentNode.removeChild(elem); });
		}
		if ('removeEventListener' in window)
			window.removeEventListener('keydown', this.keyboard, true);
		else if ('detachEvent' in document)
			document.detachEvent('onkeydown', this.keyboard);
		else
			window.onkeydown = '';
		if (m_closed)
			m_closed();
	}
};

if (!Array.indexOf) {
	Array.prototype.indexOf = function(obj) {
		for (var i = 0; i < this.length; i++)
			if(this[i] == obj)
				return i;
		return -1;
	}
}
