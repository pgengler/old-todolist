var remove       = [];
var moving       = false;

// Since we'll only allow edits to one thing at a time,
// save the current values when we edit so that they can be restored
// if the user cancels or edits another one
var saved_day = null, saved_event = null, saved_location = null, saved_start = null, saved_end = null;
var saved_done = 0;
var currently_editing = 0;

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
	var curr_week = false;

	if (!document.getElementById('template')) {
		// Check if what we're looking at isn't the current week
		var next_week_link = document.getElementById('nextweek');
		var next_week_url  = next_week_link.getAttribute('href');
		var next_week_date = next_week_url.substr(next_week_url.length - 9, 8);
		var next_week_year = next_week_date.substr(0, 4);
		var next_week_mon  = next_week_date.substr(4, 2) - 1;
		var next_week_day  = next_week_date.substr(6, 2);
		var next_week = new Date(next_week_year, next_week_mon, next_week_day);

		var today = new Date();
		if (today < next_week && !document.getElementById('currweek'))
			curr_week = true;
	}

	if (curr_week) {
		var today = (new Date()).getDay();
		var day = days[today];

		// Get table
		var table = document.getElementById('content');

		var rows = table.getElementsByTagName('tr');
		for (var i = 1; i < rows.length; i++) {
			var row = rows[i];
			var id  = '#' + row.getAttribute('id');
			row = $(id);

			var done = row.hasClass('done');
			var mark = row.hasClass('mark');

			row.removeClass();

			var date = rows[i].getElementsByTagName('td')[1].firstChild.nodeValue;

			if (date && date.trim() == day) {
				row.addClass('today');
			} else if (date && get_value_of_day(date.trim()) < today && date.trim() != '--') {
				row.addClass('past');
			} else {
				row.addClass('future');
			}
		if (done)
			row.addClass('done');
		if (mark)
			row.addClass('mark');
		}
	} else {
		// Get table
		var table = document.getElementById('content');
		var rows = table.getElementsByTagName('tr');
		for (var i = 1; i < rows.length; i++) {
			var row = $('#' + rows[i].getAttribute('id'));

			var done = row.hasClass('done');
			var mark = row.hasClass('mark');

			row.removeClass();
			row.addClass('future');

			if (done)
				row.addClass('done');
			if (mark)
				row.addClass('mark');
		}
	}
}

///////
// SYNCHRONIZE CHECKBOXES
///////
function sync_boxes()
{
	// Get table
	var table = document.getElementById('content');

	var rows = table.getElementsByTagName('tr');
	for (var i = 1; i < rows.length; i++) {
		var row = rows[i];
		var id  = row.getAttribute('id').replace(/item/, '')
		var jid = '#item' + id;
		row = $(jid);

		var done = row.hasClass('done');

		var box = document.getElementById('done' + id);

		if (done)
			box.checked = true;
		else
			box.checked = false;
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
		cell.setAttribute('colspan', use_mark ? '6' : '5');
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
	row.setAttribute('id', 'newrow');

	// Create cell for the day
	var day_cell = document.createElement('td');
	day_cell.setAttribute('colspan', '2');

	// Create new dropdown
	var dropdown = document.createElement('select');
	dropdown.setAttribute('name', 'day');
	dropdown.setAttribute('id', 'newday');

	// Create options for each day choice
	for (var i = -1; i < 7; i++) {
		var option = document.createElement('option');
		option.setAttribute('value', i);
		option.innerHTML = get_day_from_value(i);
		if (!template && i >= 0 && dates[i])
			option.innerHTML += dates[i].strftime(date_format);
		dropdown.appendChild(option);
	}
	day_cell.appendChild(dropdown);
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

	// Create empty cell for "mark"
	if (use_mark) {
		var mark_cell = document.createElement('td');
		mark_cell.innerHTML = '&nbsp;';
		row.appendChild(mark_cell);
	}

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
	if (!response)
		return;

	var root  = response.getElementsByTagName('item')[0];
	var id    = parseInt(root.getElementsByTagName('id')[0].firstChild.nodeValue);
	var week  = parseInt(root.getElementsByTagName('week')[0].firstChild.nodeValue);
	// Day can come back empty, meaning null
	var day = (undated_last == 1) ? 7 : -1;
	if (root.getElementsByTagName('day')[0].firstChild)
		day = parseInt(root.getElementsByTagName('day')[0].firstChild.nodeValue);

	var date = '';
	if (show_date && (day >= 0 && day <= 6))
		date = root.getElementsByTagName('date')[0].firstChild.nodeValue;

	var event = root.getElementsByTagName('event')[0].firstChild.nodeValue;

	// These fields are optional and so might not have any data coming back
	var location = '', start = -1, end = -1, done = 0, mark = 0;
	if (root.getElementsByTagName('location')[0].firstChild)
		location = root.getElementsByTagName('location')[0].firstChild.nodeValue;

	if (root.getElementsByTagName('start')[0].firstChild)
		start = root.getElementsByTagName('start')[0].firstChild.nodeValue;

	if (root.getElementsByTagName('end')[0].firstChild)
		end = root.getElementsByTagName('end')[0].firstChild.nodeValue;

	if (root.getElementsByTagName('done')[0].firstChild)
		done = parseInt(root.getElementsByTagName('done')[0].firstChild.nodeValue);

	if (root.getElementsByTagName('mark')[0].firstChild)
		mark = parseInt(root.getElementsByTagName('mark')[0].firstChild.nodeValue);

	// Remove the current row
	// This is done after the AJAX call to prevent lag or loss of synchronization when the server is slow or down
	var row = document.getElementById('item' + id);
	if (row)
		row.parentNode.removeChild(row);

	// Check if the item stills belongs in this this week
	var curr_week = document.getElementById('week').value;
	if (week != curr_week) {
		currently_editing = 0;
		saved_day = saved_event = saved_location = saved_start = saved_end = null;
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
	if (addrow)
		addrow.parentNode.removeChild(addrow);

	var rows = tbody.rows;

	var new_row;

	for (var i = 0; i < rows.length; i++) {
		if (rows[i].getAttribute('id') == 'header')
			continue;

		var row_cells = rows[i].getElementsByTagName('td');

		var row_day   = get_value_of_day(row_cells[1].firstChild.nodeValue.trim());

		if (day < row_day) {
			// insert it here
			new_row = tbody.insertRow(i);
			break;
		} else if (day == row_day) {
			// Same day, check for differing times and sort appropriately
			var row_times  = row_cells[4];
			var row_event  = row_cells[2].innerHTML.trim();

			var start_time = get_start_time(row_times.innerHTML);
			var end_time   = get_end_time(row_times.innerHTML);

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

	if (!new_row)
		new_row = tbody.insertRow(-1);

	new_row.setAttribute('id', 'item' + id);

	var row = $('#item' + id);

	if (use_mark && mark == 1)
		row.addClass('mark');
	if (done == 1)
		row.addClass('done');

	var done_cell = document.createElement('td');
	done_cell.setAttribute('style', 'text-align: center');
	done_cell.setAttribute('class', 'nodec');
	var done_box = document.createElement('input');
	done_box.setAttribute('type', 'checkbox');
	done_box.setAttribute('id', 'done' + id);
	if (done == 1)
		done_box.setAttribute('checked', 'checked');
	done_box.setAttribute('onclick', 'toggle_done(' + id + ')');
	done_cell.appendChild(done_box);
	new_row.appendChild(done_cell);

	var day_cell = document.createElement('td');
	day_cell.setAttribute('class', 'day');
	day_cell.setAttribute('onclick', 'show_day_edit(' + id + ')');
	day_cell.innerHTML = get_day_from_value(day);
	if (show_date && date) {
		var span = document.createElement('span');
		span.setAttribute('class', 'date');
		span.appendChild(document.createTextNode(date));
		day_cell.appendChild(span);
	}

	new_row.appendChild(day_cell);

	var event_cell = document.createElement('td');
	event_cell.appendChild(document.createTextNode(event.replace(/</, "&lt;").replace(/>/, "&gt;")));
	event_cell.setAttribute('onclick', 'show_event_edit(' + id + ')');

	new_row.appendChild(event_cell);

	var location_cell = document.createElement('td');
	location_cell.setAttribute('onclick', 'show_location_edit(' + id + ')');
	if (location)
		location_cell.innerHTML = location.replace(/</, "&lt;").replace(/>/, "&gt;");

	new_row.appendChild(location_cell);

	var time_cell = document.createElement('td');
	if (start && start != -1)
		time_cell.innerHTML = start;

	if (end && end != -1)
		time_cell.innerHTML += ' &ndash; ' + end;

	if (!time_cell.innerHTML)
		time_cell.innerHTML = '';

	time_cell.setAttribute('onclick', 'show_times_edit(' + id + ')');

	new_row.appendChild(time_cell);

	if (use_mark) {
		var mark_cell = document.createElement('td');
		mark_cell.setAttribute('style', 'text-align: center');
		mark_cell.setAttribute('class', 'nodec');
		var mark_button = document.createElement('input');
		mark_button.setAttribute('type', 'button');
		mark_button.setAttribute('id', 'mark' + id);
		mark_button.setAttribute('class', 'mark');
		mark_button.setAttribute('onclick', 'toggle_mark(' + id + ')');
		mark_button.value = '!';
		mark_cell.appendChild(mark_button);
		new_row.appendChild(mark_cell);
	}

	currently_editing = 0;
	saved_day = saved_event = saved_location = saved_start = saved_end = null;

	highlight();
	sync_boxes();
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
	var row = $('#item' + id);

	// Get the date cell
	var cell = $('#item' + id + '>td:eq(1)');

	// Temporarily suspend the "onlick" for this cell
	cell.get(0).setAttribute('onclick', 'return false');

	// Don't show strikethrough while editing
	cell.addClass('nodec');

	// Save current data
	currently_editing = id;
	saved_day = cell.text().trim();

	var	curr_day = get_value_of_day(saved_day);

	cell.empty();

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
		if (!template && i >= 0 && dates[i])
			option.innerHTML += dates[i].strftime(date_format);
		if (curr_day == i)
			option.setAttribute('selected', 'selected');
		dropdown.appendChild(option);
	}

	var next_week_option = document.createElement('option');
	next_week_option.setAttribute('value', '8');
	next_week_option.appendChild(document.createTextNode('->'));
	dropdown.appendChild(next_week_option);

	cell.append(dropdown);
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
	var row  = $('#item' + id);

	// Get the event cell
	var cell = $('#item' + id + ' > td:eq(2)');

	// Make sure we don't call this function again while we're editing
	cell.get(0).setAttribute('onclick', 'return false;');

	// Save current into
	saved_event = decode(cell.text().trim());
	saved_done  = row.hasClass('done');
	currently_editing = id;

	// Don't indicate done when editing the event
	cell.addClass('nodec');

	// Create a new textbox
	var textbox = document.createElement('input');
	textbox.setAttribute('type', 'text');
	textbox.setAttribute('name', 'event');
	textbox.setAttribute('id', 'event');
	textbox.style.width = '97%';
	textbox.value = saved_event;

	cell.empty();
	cell.append(textbox);

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

	// Get the location cell
	var cell = $('#item' + id + '>td:eq(3)');

	// Make sure we don't call this function again if we click in the textbox
	cell.get(0).setAttribute('onclick', 'return false;');

	// Don't strike through the textbox
	cell.addClass('nodec');

	// Save current info
	saved_location = decode(cell.text().trim());
	currently_editing = id;

	// Create new textbox
	var textbox = document.createElement('input');
	textbox.setAttribute('type', 'text');
	textbox.setAttribute('name', 'location');
	textbox.setAttribute('id', 'location');
	textbox.style.width = '97%';
	textbox.value = saved_location;

	cell.empty();
	cell.append(textbox);

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

	// Get the times cell
	var cell = $('#item' + id + '>td:eq(4)');

	// Make sure we don't call this function again while we're editing
	cell.get(0).setAttribute('onclick', 'return false;');

	// Don't show strikethrough while editing
	cell.addClass('nodec');

	// Save current into
	saved_start = get_start_time(cell.text());
	saved_end   = get_end_time(cell.text());
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

	cell.empty();
	cell.append(startbox);
	cell.append(span);
	cell.append(endbox);

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
	var ajax = new AJAX(base_url, update_list);

	ajax.send('action=done&id=' + id);

	// Get the current row
	var row = document.getElementById('item' + id);

	// Create spinner
	var spinner = document.createElement('img');
	spinner.setAttribute('src', 'processing.gif');

	// Get this cell
	var cell = row.getElementsByTagName('td')[0];

	// Clear cell
	remove_all_children(cell);

	// Show spinner
	cell.appendChild(spinner);
}

///////
// TOGGLE "MARKED" STATE
///////
function toggle_mark(id)
{
	if (use_mark) {
		var ajax = new AJAX(base_url, update_list);
		ajax.send('action=mark&id=' + id);

		// Get the current row
		var row = document.getElementById('item' + id);

		// Create spinner
		var spinner = document.createElement('img');
		spinner.setAttribute('src', 'processing.gif');

		// Get this cell
		var cell = row.getElementsByTagName('td')[5];

		// Clear cell
		remove_all_children(cell);

		// Show spinner
		cell.appendChild(spinner);
	}
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

	currently_editing = 0;
	saved_day = saved_event = saved_location = saved_start = saved_end = null;
}

///////
// MISC FUNCTIONS
///////
function create_hidden_submit()
{
	// Check if the hidden submit button already exists
	var button = document.getElementById('submit');

	if (button)
		return;

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
	// Reset any items in an "edit" state
	
	// Remove the add bar, if it's around
	var add_row = document.getElementById('newrow');

	if (add_row)
		add_row.parentNode.removeChild(add_row);

	// Remove the hidden submit button, if it's around
	var button = document.getElementById('submit');
	if (button)
		button.parentNode.removeChild(button);

	if (currently_editing == 0 || currently_editing == id)
		return;

	if (saved_day) {
		var day = $('#item' + currently_editing + '>td:eq(1)');

		// Restore original content & state
		day.empty();
		day.append(saved_day);
		day.get(0).setAttribute('onclick', 'show_day_edit(' + currently_editing + ')');
		day.removeClass('nodec');
	}

	if (saved_event) {
		var event = $('#item' + currently_editing + '>td:eq(2)');

		// Restore original content & state
		event.empty();
		event.append(saved_event);
		event.get(0).setAttribute('onclick', 'show_event_edit(' + currently_editing + ')');
		event.removeClass('nodec');
	}

	if (saved_location != null) {
		var location = $('#item' + currently_editing + '>td:eq(3)');

		// Restore original content & state
		location.empty();
		location.append(saved_location);
		location.get(0).setAttribute('onclick', 'show_location_edit(' + currently_editing + ')');
		location.removeClass('nodec');
	}

	if (saved_start != null || saved_end != null) {
		var time = $('#item' + currently_editing + '>td:eq(4)');

		// Restore original content and state
		time.empty();
		var time_show = '';
		if (saved_start != -1)
			time_show = saved_start;
		if (saved_end != -1) {
			time_show += ' &ndash; ';
			time_show += saved_end;
		}
		
		time.append(time_show);
		time.get(0).setAttribute('onclick', 'show_times_edit(' + currently_editing + ')');
		time.removeClass('nodec');
	}

	currently_editing = 0;
	saved_day = saved_event = saved_location = saved_start = saved_end = null;
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
	if (day.substring(0, 2) == '--')
			return (undated_last == 1) ? 7 : -1;

	switch (day.substring(0, 3)) {
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

function get_start_time(time_val)
{
	// If there's no data, there's no time
	if (!time_val || time_val.indexOf('&nbsp;') != -1)
		return -1;

	if (time_val.trim().length < 4)
		return -1;

	// If there's no " &ndash;", use the whole contents as the start time
	var pos = time_val.trim().indexOf('&ndash;');

	if (pos == -1)
		pos = time_val.trim().indexOf(String.fromCharCode(8211));

	if (pos == -1)
		return time_val.trim();
	else if (pos == 0 || pos == 1)
		return -1;

	if (pos > 4)
		pos = 4;

	return time_val.trim().substring(0, pos).trim();
}

function get_end_time(time_val)
{
	// If there's no data, there's no time
	if (!time_val || time_val.trim().length == 0 || time_val.indexOf('&nbsp;') != -1)
		return -1;

	// If there's no "&ndash;", there's no end time
	var pos;
	if ((pos = time_val.trim().indexOf(String.fromCharCode(8211))) == -1)
		return -1;

	return time_val.trim().substring(pos + 1).trim();
}

///////
// OPTIONS
///////
function toggle_options()
{
	// Get options span
	var options = document.getElementById('options');

	// Get show/hide text element
	var options_tog = document.getElementById('optiontoggle');

	// Update
	if (options.getAttribute('class') == 'hidden') {
		options.setAttribute('class', '');
		options_tog.removeChild(options_tog.childNodes[0]);
		options_tog.appendChild(document.createTextNode(' [hide] '));
	} else {
		options.setAttribute('class', 'hidden');
		options_tog.removeChild(options_tog.childNodes[0]);
		options_tog.appendChild(document.createTextNode(' [show] '));
	}

	return false;
}

function load_template()
{
	// Get week ID
	var week = document.getElementById('week').value;

	if (!week) {
		return false;
	}

	// Construct URL
	var url = index_url + '?act=template;week=' + week;

	// Go to new URL
	window.location.href = url;

	return false;
}

function move_incomplete()
{
	// Get week ID
	var week = document.getElementById('week').value;

	// Create AJAX object
	var ajax = new AJAX(base_url, move_incomplete_aux, 5000, move_incomplete_timeout);

	// Make AJAX request
	ajax.send('action=move&week=' + week);

	return false;
}

function move_incomplete_aux(response)
{
	var root  = response.getElementsByTagName('moved')[0];
	var items = root.getElementsByTagName('item');

	var len   = items.length;

	for (var i = 0; i < len; i++) {
		var id = items[i].getAttribute('id');

		// Get row for this
		var row = document.getElementById('item' + id);

		// Remove it
		if (row)
			row.parentNode.removeChild(row);
	}
}

function move_incomplete_timeout(ajax)
{
	ajax.abort();
}

///////
// TOGGLE COLOR KEY
///////
function toggle_colors()
{
	var key = document.getElementById('colors');
	var link = document.getElementById('colorlabel');

	if (key.getAttribute('class').match(/hidden/)) {
		key.setAttribute('class', '');
		link.removeChild(link.childNodes[0]);
		link.appendChild(document.createTextNode('Hide color key'));
	} else {
		key.setAttribute('class', 'hidden');
		link.removeChild(link.childNodes[0]);
		link.appendChild(document.createTextNode('Show color key'));
	}
	return false;
}

///////
// HELPER FUNCTIONS
///////

function decode(str)
{
	var tmp = str.replace(/\&amp\;/, "&");
	tmp = tmp.replace(/\&lt\;/, "<");
	tmp = tmp.replace(/\&gt\;/, ">");
	return tmp;
}

function remove_all_children(elem)
{
	var len = elem.childNodes.length;
	for (var i = 0; i < len; i++) {
		elem.removeChild(elem.childNodes[0]);
	}
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
	sync_boxes();
	setInterval("highlight()", 300000);
}
