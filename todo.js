var base_url = 'http://personal.pgengler.net/todo/ajax.cgi';
var undated_last = 0;

// Since we'll only allow edits to one thing at a time,
// save the current values when we edit so that they can be restored
// if the user cancels or edits another one
var saved_day, saved_event, saved_location, saved_start, saved_end, saved_done, currently_editing;

///////
// KEYBOARD HANDLER
///////
function key_handler(event)
{
	event = (event) ? event : ((window.event) ? event : null);

	if (event) {
		key = (event.charCode) ? event.charCode : ((event.which) ? event.which : event.keyCode);
		if (event.altKey && String.fromCharCode(key).toLowerCase() == 'n') { // Alt+N (new)
			new_item_form();
		} else if (key == 27) {
			clear_edits();
		}
  }
}

///////
// HIGHLIGHT CURRENT DAY'S ITEMS
///////
var days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function highlight()
{
	// Skip if this is the template
	if (document.getElementById('template')) {
		return;
	}

	// Skip if this wasn't the current week when loaded
	if (document.getElementById('currweek')) {
		return;
	}

	// Skip if this is no longer the current week
	var next_week_link = document.getElementById('nextweek');
	var next_week_url  = next_week_link.getAttribute('href');
	var next_week_date = next_week_url.substr(next_week_url.length - 9, 8);
	var next_week_year = next_week_date.substr(0, 4);
	var next_week_mon  = next_week_date.substr(4, 2) - 1;
	var next_week_day  = next_week_date.substr(6, 2);
	var next_week = new Date(next_week_year, next_week_mon, next_week_day);

	var today = new Date();
	if (today > next_week) {
		return;
	}

	var day = days[today.getDay()];

	// Get table
	var table = document.getElementById('content');

	var rows = table.getElementsByTagName('tr');
	for (var i = 1; i < rows.length; i++) {
		var date = rows[i].getElementsByTagName('td')[0].innerHTML;
		if (date.trim() == day) {
			rows[i].setAttribute('class', 'today');
		} else {
			rows[i].setAttribute('class', 'front');
		}
	}
}

///////
// DISPATCH
///////
function dispatch()
{
	// If the form is being submitted but nothing is being edited, assume we're adding a new item
	if (!currently_editing) {
		submit_new_item();
	} else {
		// Figure out what's changing
		var update_event = 0, update_location = 0, update_times = 0;
		var changed  = 0;	// bitwise; 1 == event, 2 == location, 4 == times
		var event, location, start, end;

		// Look for an event textbox
		var event_box = document.getElementById('event');
		if (event_box) {
			event = event_box.value;
			if (!event || event.trim().length == 0) {
				delete_item(currently_editing);
				return;
			}
			update_event = 1;
			changed += 1;
		}

		// Look for a location textbox
		var location_box = document.getElementById('location');
		if (location_box) {
			location = location_box.value;
			update_location = 1;
			changed += 2;
		}

		// Look for a start time textbox
		var start_box = document.getElementById('start');
		var end_box   = document.getElementById('end');
		if (start_box) {
			start = start_box.value;
			end   = end_box.value;
			update_times = 1;
			changed += 4;
		}

		// Build param string
		var param_string = "action=save&id=" + currently_editing + '&changed= '+ changed + '&';
		if (update_event) {
			param_string += "event=" + escape(event) + "&";
		}
		if (update_location) {
			param_string += "location=" + escape(location) + "&";
		}
		if (update_times) {
			param_string += "start=" + start + "&end=" + end;
		}

		// Replace the row with a processing message
		var row = document.getElementById('item' + currently_editing);
		var len = row.getElementsByTagName('td').length;
		for (var i = 0; i < len; i++) {
			row.removeChild(row.getElementsByTagName('td')[0]);
		}
		var cell = document.createElement('td');
		cell.setAttribute('colspan', '5');
		cell.setAttribute('style', 'font-style: italic; text-align: center');
		cell.innerHTML = 'Processing...';
		row.appendChild(cell);

		var ajax = new AJAX(base_url, update_list);

		ajax.send(param_string);
	}
}

function new_item_form()
{
	clear_edits();
	create_hidden_submit();

	// Only ever have one "new" row up at a time
	var already_row = document.getElementById('newrow');

	if (already_row) {
		return;
	}

	// Get the table
	var table = document.getElementById('content');
	// Get tbody
	var tbody = table.getElementsByTagName('tbody')[0];

	// Add a new row to the table
	var row = document.createElement('tr');
	row.setAttribute('class', 'front');
	row.setAttribute('id', 'newrow');

	// Create cell for the day
	var day_cell = document.createElement('td');
	day_cell.innerHTML = "<select name='day' id='newday'><option value='-'>--</option><option value='0'>Sun</option><option value='1'>Mon</option><option value='2'>Tue</option><option value='3'>Wed</option><option value='4'>Thu</option><option value='5'>Fri</option><option value='6'>Sat</option></select>";

	row.appendChild(day_cell);

	// Create cell for the event
	var event_cell = document.createElement('td');
	event_cell.innerHTML = "<input type='text' name='newevent' id='newevent' style='width: 97%' />";

	row.appendChild(event_cell);

	// Create cell for location
	var location_cell = document.createElement('td');
	location_cell.innerHTML = "<input type='text' name='newlocation' id='newlocation' style='width: 97%' />";

	row.appendChild(location_cell);

	// Create cell for times
	var time_cell = document.createElement('td');
	time_cell.innerHTML = "<input type='text' name='newstart' id='newstart' class='time' /> &ndash; <input type='text' name='newend' id='newend' class='time' />";

	row.appendChild(time_cell);

	// Create empty cell for "done"
	var done_cell = document.createElement('td');
	done_cell.innerHTML = '&nbsp;';

	row.appendChild(done_cell);

	// Add the new row to the table
	tbody.appendChild(row);

	// Set the focus on the day dropdown
	var dropdown = document.getElementById('newday');
	dropdown.focus();
}

function submit_new_item()
{
	// Get values
	var week = document.getElementById('week').value;

	var day_box      = document.getElementById('newday');
	var event_box    = document.getElementById('newevent');
	var location_box = document.getElementById('newlocation');
	var start_box    = document.getElementById('newstart');
	var end_box      = document.getElementById('newend');

	var day      = day_box.value;
	var event    = event_box.value;
	var location = location_box.value;
	var start    = start_box.value;
	var end      = end_box.value;

	var ajax = new AJAX(base_url, update_list);

	ajax.send('action=add&week=' + week + '&day=' + day + '&event=' + escape(event) + '&location=' + escape(location) + '&start=' + start + '&end=' + end);

	// Provide some feedback to let the user know that something's happening
	var row = document.getElementById('newrow');
	var parent = row.parentNode;
	parent.removeChild(row);

	row = document.createElement('tr');
	row.setAttribute('id', 'newrow');
	row.setAttribute('class', 'front');

	var cell = document.createElement('td');
	cell.setAttribute('colspan', '5');
	cell.setAttribute('style', 'font-style: italic; text-align: center');
	cell.innerHTML = 'Processing...';

	row.appendChild(cell);
	parent.appendChild(row);
}

function update_list(response)
{
	if (!response) {
		return;
	}

	var root  = response.getElementsByTagName('item')[0];
	var id    = root.getElementsByTagName('id')[0].firstChild.nodeValue;
	var week  = root.getElementsByTagName('week')[0].firstChild.nodeValue;
	// Day can come back empty, meaning null
	var day = (undated_last == 1) ? 7 : -1;
	if (root.getElementsByTagName('day')[0].firstChild) {
		day = root.getElementsByTagName('day')[0].firstChild.nodeValue;
	}
	var event = root.getElementsByTagName('event')[0].firstChild.nodeValue;
	// These fields are optional and so might not have any data coming back
	var location = '', start = -1, end = -1, done = 0;
	if (root.getElementsByTagName('location')[0].firstChild) {
		location = root.getElementsByTagName('location')[0].firstChild.nodeValue;
	}
	if (root.getElementsByTagName('start')[0].firstChild) {
		start = root.getElementsByTagName('start')[0].firstChild.nodeValue;
	}
	if (root.getElementsByTagName('end')[0].firstChild) {
		end = root.getElementsByTagName('end')[0].firstChild.nodeValue;
	}
	if (root.getElementsByTagName('done')[0].firstChild) {
		done = root.getElementsByTagName('done')[0].firstChild.nodeValue;
	}

	// Remove the current row
	// This is done after the AJAX call to prevent lag or loss of synchronization when the server is slow or down
	var row = document.getElementById('item' + id);
	if (row) {
		row.parentNode.removeChild(row);
	}

	// Check if the item stills belongs in this this week
	var curr_week = document.getElementById('week').value;
	if (week != curr_week) {
		return;
	}

	// Now, we need to figure out where this belongs
	// Items without a date go in front of this with; otherwise, normal week order applies (Sunday-Saturday)
	// Items without a start or end time go ahead of those with either, followed by items with only end times
	// (sorted by end time). These are followed by items with start times, ordered by start time.

	// Get the table
	var table = document.getElementById('content');
	var tbody = table.getElementsByTagName('tbody')[0];

	// Remove the "add" row, which is the last row in the table
	var addrow = document.getElementById('newrow');
	if (addrow) {
		addrow.parentNode.removeChild(addrow);
	}

	var rows = tbody.rows;

	var new_row;

	for (var i = 0; i < rows.length; i++) {
		if (rows[i].getAttribute('id') == 'header') {
			continue;
		}

		var row_cells = rows[i].getElementsByTagName('td');

		var row_day   = get_value_of_day(row_cells[0].innerHTML.trim());

		if (day < row_day) {
			// insert it here
			new_row = tbody.insertRow(i);
			break;
		} else if (day == row_day) {
			// Same day, check for differing times and sort appropriately
			var row_times  = row_cells[3];
			var row_event  = row_cells[1].getElementsByTagName('span')[0].innerHTML.trim();

			var start_time = get_start_time(row_times);
			var end_time   = get_end_time(row_times);

			if (start == -1 && end == -1) {
				if ((event.toUpperCase() < row_event.toUpperCase()) || (start_time != -1 || end_time != -1)) {
					new_row = tbody.insertRow(i);
					break;
				}
			} else if (start == -1 && end != -1) {
				if (start_time != -1) {
					new_row = tbody.insertRow(i);
					break;
				} else if (end < end_time) {
					new_row = tbody.insertRow(i);
					break;
				} else if (end == end_time) {
					if (event.toUpperCase() < row_event.toUpperCase()) {
						new_row = tbody.insertRow(i);
						break;
					}
				}
			} else if (start != -1 && end == -1) {
				if (start < start_time) {
					new_row = tbody.insertRow(i);
					break;
				} else if (start == start_time) {
					if (event.toUpperCase() < row_event.toUpperCase()) {
						new_row = tbody.insertRow(i);
						break;
					}
				}
			} else if (start < start_time) {
				new_row = tbody.insertRow(i);
				break;
			} else if (start == start_time) {
				if (event.toUpperCase() < row_event.toUpperCase()) {
					new_row = tbody.insertRow(i);
					break;
				}
			}
		}
	}

	var append = 0;
	if (!new_row) {
		new_row = document.createElement('tr');
		append = 1;
	}

	new_row.setAttribute('class', 'front');
	new_row.setAttribute('id', 'item' + id);

	var day_cell = document.createElement('td');
	day_cell.setAttribute('class', 'day');
	day_cell.setAttribute('onclick', 'show_day_edit(' + id + ')');
	day_cell.innerHTML = get_day_from_value(day);

	new_row.appendChild(day_cell);

	var event_cell = document.createElement('td');
	var event_container = document.createElement('span');
	event_container.innerHTML = event.replace(/</, "&lt;").replace(/>/, "&gt;");
	if (done != 0) {
		event_container.setAttribute('class', 'done');
	}
	event_cell.appendChild(event_container);
	event_cell.setAttribute('onclick', 'show_event_edit(' + id + ')');

	new_row.appendChild(event_cell);

	var location_cell = document.createElement('td');
	location_cell.setAttribute('onclick', 'show_location_edit(' + id + ')');
	if (location) {
		location_cell.innerHTML = location.replace(/</, "&lt;").replace(/>/, "&gt;");
	}

	new_row.appendChild(location_cell);

	var time_cell = document.createElement('td');
	if (start && start != -1) {
		time_cell.innerHTML = start;
	}
	if (end && end != -1) {
		time_cell.innerHTML += ' &ndash; ' + end;
	}
	if (!time_cell.innerHTML) {
		time_cell.innerHTML = '&nbsp;';
	}
	time_cell.setAttribute('onclick', 'show_times_edit(' + id + ')');

	new_row.appendChild(time_cell);

	var done_cell = document.createElement('td');
	done_cell.setAttribute('style', 'text-align: center');
	var done_button = document.createElement('input');
	done_button.setAttribute('type', 'button');
	done_button.setAttribute('id', 'done' + id);
	done_button.setAttribute('class', 'done');
	done_button.setAttribute('onclick', 'toggle_done(' + id + ')');
	done_button.value = '*';

	done_cell.appendChild(done_button);
	new_row.appendChild(done_cell);

	if (append == 1) {
		tbody.appendChild(new_row);
	}
	highlight();
}

///////
// EDITING
///////

function show_day_edit(id)
{
	// Clear other edits
	clear_edits(id);

	// Create submit button
	create_hidden_submit();

	// Get the row with this ID
	var row = document.getElementById('item' + id);

	// Get the date cell
	var cell = row.getElementsByTagName('td')[0];

	// Temporarily suspend the "onlick" for this cell
	cell.setAttribute('onclick', 'return false;');

	// Save current data
	currently_editing = id;
	saved_day = cell.innerHTML.trim();

	var	curr_day = get_value_of_day(cell.innerHTML.trim());

	cell.innerHTML = '';

	// Create new dropdown
	var dropdown = document.createElement('select');
	dropdown.setAttribute('name', 'day');
	dropdown.setAttribute('id', 'day');
	dropdown.setAttribute('onchange', 'save_day(' + id + ')');

	// Create options for each day choice
	for (var i = -1; i < 7; i++) {
		var option = document.createElement('option');
		option.setAttribute('value', i);
		option.innerHTML = get_day_from_value(i);
		if (curr_day == i) {
			option.setAttribute('selected', 'selected');
		}
		dropdown.appendChild(option);
	}

	var next_week_option = document.createElement('option');
	next_week_option.setAttribute('value', '8');
	next_week_option.appendChild(document.createTextNode('->'));
	dropdown.appendChild(next_week_option);

	cell.appendChild(dropdown);
	dropdown.focus();
}

function save_day(id)
{
	// Get the day box
	var daybox = document.getElementById('day');

	var newday = daybox.value;

	var ajax = new AJAX(base_url, update_list);

	ajax.send('action=day&id=' + id + '&day=' + newday);
}

function show_event_edit(id)
{
	// Clear other edits
	clear_edits(id);

	// Create submit button
	create_hidden_submit();

	// Get the row we're editing in
	var row = document.getElementById('item' + id);

	// Get the event cell
	var cell = row.getElementsByTagName('td')[1];

	// Make sure we don't call this function again while we're editing
	cell.setAttribute('onclick', '');

	// Get the event container
	var container = cell.getElementsByTagName('span')[0];

	// Save current into
	saved_event = decode(container.innerHTML.trim());
	saved_done  = (container.getAttribute('class') == 'done');
	currently_editing = id;

	// Don't indicate done when editing the event
	container.setAttribute('class', '');

	// Create a new textbox
	var textbox = document.createElement('input');
	textbox.setAttribute('type', 'text');
	textbox.setAttribute('name', 'event');
	textbox.setAttribute('id', 'event');
	textbox.style.width = '97%';
	textbox.value = saved_event;

	container.innerHTML = '';
	container.appendChild(textbox);

	// Focus the new box
	textbox.focus();

	// Select the text in the box
	textbox.select();
}

function show_location_edit(id)
{
	// Clear other edits
	clear_edits(id);

	// Create submit button
	create_hidden_submit();

	// Get the row we're editing in
	var row = document.getElementById('item' + id);

	// Get the location cell
	var cell = row.getElementsByTagName('td')[2];

	// Make sure we don't call this function again if we click in the textbox
	cell.setAttribute('onclick', '');

	// Save current info
	saved_location = decode(cell.innerHTML.trim());
	currently_editing = id;

	// Create new textbox
	var textbox = document.createElement('input');
	textbox.setAttribute('type', 'text');
	textbox.setAttribute('name', 'location');
	textbox.setAttribute('id', 'location');
	textbox.style.width = '97%';
	textbox.value = saved_location;

	cell.innerHTML = '';
	cell.appendChild(textbox);

	// Focus the new textbox
	textbox.focus();

	// Select the text in the box
	textbox.select();
}

function show_times_edit(id)
{
	// Clear other edits
	clear_edits(id);

	// Create submit button
	create_hidden_submit();

	// Get the row we're editing in
	var row = document.getElementById('item' + id);

	// Get the times cell
	var cell = row.getElementsByTagName('td')[3];

	// Make sure we don't call this function again while we're editing
	cell.setAttribute('onclick', '');

	// Save current into
	saved_start = get_start_time(cell);
	saved_end   = get_end_time(cell);
	currently_editing = id;

	// Create a new start time textbox
	var startbox = document.createElement('input');
	startbox.setAttribute('type', 'text');
	startbox.setAttribute('name', 'start');
	startbox.setAttribute('id', 'start');
	startbox.setAttribute('class', 'time');

	if (saved_start != -1) {
		startbox.value = saved_start;
	}

	// Create a new end time textbox
	var endbox = document.createElement('input');
	endbox.setAttribute('type', 'text');
	endbox.setAttribute('name', 'end');
	endbox.setAttribute('id', 'end');
	endbox.setAttribute('class', 'time');

	if (saved_end != -1) {
		endbox.value = saved_end;
	}

	// Create a new span with an &ndash;
	var span = document.createElement('span');
	span.innerHTML = ' &ndash; ';

	cell.innerHTML = '';
	cell.appendChild(startbox);
	cell.appendChild(span);
	cell.appendChild(endbox);

	// Focus the start time box
	startbox.focus();

	// Select the text in the box
	startbox.select();

}

///////
// TOGGLE "DONE" STATE
///////
function toggle_done(id)
{
	// Remove the current row
//	var row = document.getElementById('item' + id);
//	row.parentNode.removeChild(row);

	var ajax = new AJAX(base_url, update_list);

	ajax.send('action=done&id=' + id);

}

///////
// DELETE ITEM
///////
function delete_item(id)
{
	// remove the row for this item
	var row = document.getElementById('item' + id);
	row.parentNode.removeChild(row);

	var ajax = new AJAX(base_url);

	ajax.send('action=delete&id=' + id);
}

///////
// MISC FUNCTIONS
///////
function create_hidden_submit()
{
	// Check if the hidden submit button already exists
	var button = document.getElementById('submit');

	if (button) {
		return;
	}

	// Create a new button
	button = document.createElement('input');
	button.setAttribute('type', 'submit');
	button.setAttribute('id', 'submit');
	button.style.display = 'none';

	// Get the document's form
	var form = document.getElementById('form');

	// Add the button to the form
	form.appendChild(button);
}

function clear_edits(id)
{
	// Reset the any items in an "edit" state
	
	// Remove the add bar, if it's around
	var add_row = document.getElementById('newrow');

	if (add_row) {
		// Get the containing <tbody>
		var tbody = document.getElementById('content').getElementsByTagName('tbody')[0];
		tbody.removeChild(add_row);
	}

	// Remove the hidden submit button, if it's around
	var button = document.getElementById('submit');
	if (button) {
		button.parentNode.removeChild(button);
	}

	if (currently_editing == 0 || currently_editing == id) {
		return;
	}

	// look for a day box
	var daybox = document.getElementById('day');
	if (daybox) {
		// get the cell containing the box
		var cell = document.getElementById('item' + currently_editing).getElementsByTagName('td')[0];

		// remove the box
		cell.removeChild(daybox);

		// restore the date text
		cell.innerHTML = saved_day;

		// restore onclick()
		cell.setAttribute('onclick', 'show_day_edit(' + currently_editing + ')');
	}

	// look for an event texbox
	var event_box = document.getElementById('event');
	if (event_box) {
		// get the box's container
		var container = event_box.parentNode;

		// remove the box
		container.removeChild(event_box);

		// restore the original event
		container.innerHTML = saved_event;

		// restore onclick()
		container.parentNode.setAttribute('onclick', 'show_event_edit(' + currently_editing + ')');

		// restore indication of completion, if necessart
		if (saved_done) {
			container.setAttribute('class', 'done');
		}
	}

	// Look for a location textbox
	var location_box = document.getElementById('location');
	if (location_box) {
		// get the cell containing the box
		var cell = location_box.parentNode;

		// remove the box
		cell.removeChild(location_box);

		// restore the original location
		cell.innerHTML = saved_location;

		// restore onclick
		cell.setAttribute('onclick', 'show_location_edit(' + currently_editing + ')');
	}

	// Look for a start time box (which always appears with an end time box, if it appears at all)
	var start_box = document.getElementById('start');
	var end_box   = document.getElementById('end');
	if (start_box) {
		// get containing cell
		var cell = start_box.parentNode;

		// remove boxes
		cell.removeChild(start_box);
		cell.removeChild(end_box);
		cell.innerHTML = '';

		// restore the original times
		if (saved_start != -1) {
			cell.innerHTML = saved_start;
		}
		if (saved_end != -1) {
			cell.innerHTML += " &ndash; " + saved_end;
		}

		// restore onclick()
		cell.setAttribute('onclick', 'show_times_edit(' + currently_editing + ')');
	}

	currently_editing = 0;
}

function get_day_from_value(value)
{
	// For some reason, switch/case doesn't want to work here
	if (value == ((undated_last == 1) ? 7 : -1)) {
		return '--';
	} else if (value == 0) {
		return 'Sun';
	} else if (value == 1) {
		return 'Mon';
	} else if (value == 2) {
		return 'Tue';
	} else if (value == 3) {
		return 'Wed';
	} else if (value == 4) {
		return 'Thu';
	} else if (value == 5) {
		return 'Fri';
	} else if (value == 6) {
		return 'Sat'
	} else {
		return '--';
	}
}

function get_value_of_day(day)
{
	switch (day) {
		case '--':
			return (undated_last == 1) ? 7 : -1;
		case 'Sun':
			return 0;
		case 'Mon':
			return 1;
		case 'Tue':
			return 2;
		case 'Wed':
			return 3;
		case 'Thu':
			return 4;
		case 'Fri':
			return 5;
		case 'Sat':
			return 6;
	}
}

function get_start_time(time_cell)
{
	// If there's no data, there's no time
	if (!time_cell || time_cell.innerHTML.indexOf('&nbsp;') != -1) {
		return -1;
	}

	if (time_cell.innerHTML.trim().length < 4) {
		return -1;
	}

	// If there's no " &ndash;", use the whole contents as the start time
	var pos = time_cell.innerHTML.trim().indexOf('&ndash;');

	if (pos == -1) {
		pos = time_cell.innerHTML.trim().indexOf(String.fromCharCode(8211));
	}
	if (pos == -1) {
		return time_cell.innerHTML.trim();
	} else if (pos == 0 || pos == 1) {
		return -1;
	}

	if (pos > 4) {
		pos = 4;
	}
	return time_cell.innerHTML.trim().substring(0, pos).trim();
}

function get_end_time(time_cell)
{
	// If there's no data, there's no time
	if (!time_cell || time_cell.innerHTML.trim().length == 0 || time_cell.innerHTML.indexOf('&nbsp;') != -1) {
		return -1;
	}

	// If there's no "&ndash;", there's no end time
	var pos;
	if ((pos = time_cell.innerHTML.trim().indexOf(String.fromCharCode(8211))) == -1) {
		return -1;
	}

	return time_cell.innerHTML.trim().substring(pos + 1).trim();
}

function decode(str)
{
	var tmp = str.replace(/\&amp\;/, "&");
	tmp = tmp.replace(/\&lt\;/, "<");
	tmp = tmp.replace(/\&gt\;/, ">");
	return tmp;
}

String.prototype.trim = function() {
	return this.replace(/^\s+|\s+$/g,"");
}
String.prototype.ltrim = function() {
	return this.replace(/^\s+/,"");
}
String.prototype.rtrim = function() {
	return this.replace(/\s+$/,"");
}

window.onload = function() {
	highlight();
	setInterval("highlight()", 300000);
}
