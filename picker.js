var Picker = function(options)
{
	var m_date       = options ? options.date : new Date();
	var m_day        = m_date == null ? (options ? options.day : 0) : m_date.getDay();
	var days         =  ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
	var me           = this;
	var m_selected   = null;
	var m_anim_callback = options ? options.anim_callback : null;
	var m_closed     = options ? options.closed : null;
	var m_any_date   = options ? options.any_date : true;
	var m_start_day  = options ? (options.start_day ? options.start_day : 0) : 0;
	var m_start_date = options ? options.start_date : null;

	this.show = function(elem, callback)
	{
		this.callback = callback;

		var picker = {
			element: 'div', cssclass: 'picker', id: 'picker', children: [
				{ element: 'input', cssclass: 'picker', type: 'button', value: '--', id: 'picker_0' }
			]
		};

		for (var i = m_start_day; i < days.length + m_start_day; i++) {
			var this_day = i % 7;

			var value;
			if (m_start_date) {
				date = new Date(m_start_date);
				date.setDate(m_start_date.getDate() + i);
				value = days[this_day] + date.strftime(" (%m/%d)");
			} else
				value = days[this_day];

			var css = 'picker';
			if ((m_date && date && m_date.equals(date)) || (!m_date && m_day == this_day))
				css += ' sel';

			picker.children.push({
				element: 'input', cssclass: css, type: 'button', id: 'picker_' + (this_day + 1), value: value,
			});
		}

		if (m_any_date) {
			picker.children.push({
				element: 'input', type: 'button', cssclass: m_date ? 'picker sel' : 'picker', value: 'Pick ->', id: 'picker_pick', onclick: function() { $('#picker_pick').datepicker('show'); }
			});
		}

		picker = create_element(picker);
		document.body.appendChild(picker);

		// Add event handlers
		$('input.picker')
			.click(function(e) { me.select_day(e); })
			.mouseover(function(e) { me.highlight($(this)); })
			.mouseout(function(e) { me.unhighlight($(this)); })
			.keydown(function(e) { me.keyboard(e, $(this)); });
		$('input#picker_pick')
			.unbind('click')
			.datepicker({ buttonText: 'Pick', onSelect: this.select_date, defaultDate: m_date, dateFormat: 'yy-mm-dd' });

		// Position near the element that opened this
		$(picker).css(elem.position());

		// Set focus to first item in picker
		document.getElementById('picker_0').focus();

		// Animate opening
		$(picker).slideDown('fast', m_anim_callback);
	};

	this.highlight = function(elem)
	{
		me.unhighlight();
		if (elem)
			elem.addClass('hover');
	};

	this.unhighlight = function(elem)
	{
		m_selected = null;
		$('input.hover').removeClass('hover');
	};

	this.keyboard = function(event, elem)
	{
		var key  = event.which;
		var char = String.fromCharCode(key).toLowerCase();

		var stop = false;

		switch (key) {
			/* Escape key: close whole dropdown */
			case 27:
				me.hide(true);
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
				var picker = $('#picker');
				if (!m_selected)
					m_selected = 0;
				var current = $('#picker_' + m_selected);
				me.unhighlight(current);

				if (current.prev().length != 0) {
					me.highlight(current.prev());
					m_selected = current.prev().attr('id').replace('picker_', '');
				} else {
					me.highlight(picker.children(':last-child'))
					m_selected = picker.children(':last-child').attr('id').replace('picker_', '');
				}
				stop = true;
				break;

			/* Down arrow: Move selection one element lower (wraps) */
			case 40:
				var picker = $('#picker');
				if (!m_selected)
					m_selected = 0;
				var current = $('#picker_' + m_selected);
				me.unhighlight(current);

				if (current.next().length != 0) {
					me.highlight(current.next());
					m_selected = current.next().attr('id').replace('picker_', '');
				} else {
					me.highlight(picker.children(':first-child'))
					m_selected = picker.children(':first-child').attr('id').replace('picker_', '');
				}
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

				// Chrome gives a different key value for the hyphen than FF
				if (key == 189) {
					key = 109;
				}
				var keys = [
					109, /* '-' (Firefox) */
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

		if (stop) {
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

	this.hide = function(cancel)
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
			m_closed(cancel);
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
