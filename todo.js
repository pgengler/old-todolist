var template     = 0;
var items        = new Items();
var tags         = new Tags();
var used_tags    = new Hash();
var show_tags    = new Hash();
var extra_states = new Hash();
var menu_stack   = [];

// Since we'll only allow edits to one thing at a time,
// save the current values when we edit so that they can be restored
// if the user cancels or edits another one
var currently_editing = 0;
var select_tags       = 0;
var new_tag_style     = 1;

///////
// INITIALIZATION
///////
$(document).ready(function() { setInterval("highlight()", 300000); });

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
			hide_tags_menu();
			hide_styles_dropdown();
			hide_edit_tags();
		}
  }
}

///////
// SHOW OPTIONS
///////
function show_options()
{
	// Check if we already have this set up; if we do, no need to do this again
	if (document.getElementById('content_options'))
		return;

	create_extra_box('options', 'Options');

	var options = [
		{ link: 'javascript:load_template()', text: 'Load template' },
		{ link: 'javascript:move_incomplete()', text: 'Move unfinished items to next week' },
		{ link: index_url + 'template/', text: 'Edit template' }
	];
	if (use_mark)
		options.push({ id: 'showcolorkey', link: 'javascript:toggle_color_key()', text: 'Show color key' });

	var options_list = document.createElement('ul');
	options_list.setAttribute('id', 'optionslist');

	for (var i = 0; i < options.length; i++) {
		var item = document.createElement('li');
		var link = document.createElement('a');
		if (options[i].id)
			link.setAttribute('id', options[i].id);
		link.setAttribute('href', options[i].link);
		link.appendChild(document.createTextNode(options[i].text));
		item.appendChild(link);
		options_list.appendChild(item);
	}
	document.getElementById('content_options').appendChild(options_list);
}

///////
// POPULATE
// Clear the table and (re)populate it based on the 'items' object/array
///////
function populate()
{
	// Get the table body
	var tbody = document.getElementById('content').getElementsByTagName('tbody')[0];

	if (!template)
		show_options();

	// Empty it
	remove_all_children(tbody);

	delete used_tags;
	used_tags = new Hash();

	// Add rows
	var things = items.get_items();
	var len = things.length;
	for (var i = 0; i < len; i++) {
		var c = things[i];

		// Figure out if any of the item's tags match
		var itags = c.tags();
		var tlen  = itags.length;
		var ok    = (tlen == 0 && show_tags.length == 0) ? true : false;
		for (var j = 0; j < tlen; j++) {
			if (show_tags.length == 0 || show_tags.hasItem(itags[j]))
				ok = true;
			used_tags.setItem(itags[j], 1);
		}
					
		if (ok) {
			var row = tbody.insertRow(-1);
			populate_row(row, c);
		}
	}
	highlight();
	sync_boxes();

	populate_tag_selector();
}

function populate_row(row, item)
{
	remove_all_children(row);

	row.setAttribute('id', 'item' + item.id());
	var cls = 'future';
	if (item.done())
		cls += ' done';
	if (item.marked())
		cls += ' mark';
	row.setAttribute('class', cls);

	// Create cell for 'done' box
	var done_cell = document.createElement('td');
	var done_box = document.createElement('input');
	done_box.setAttribute('type', 'checkbox');
	done_box.setAttribute('id', 'done' + item.id());
	done_box.setAttribute('onclick', 'toggle_done(' + item.id() + ')');
	done_cell.appendChild(done_box);
	row.appendChild(done_cell);

	// Create cell for day
	var day_cell = document.createElement('td');
	day_cell.setAttribute('class', 'day');
	day_cell.setAttribute('onclick', 'show_day_edit(' + item.id() + ')');
	day_cell.appendChild(document.createTextNode(get_day_from_value(item.day())));
	if (show_date) {
		var date_span = document.createElement('span');
		date_span.setAttribute('class', 'date');
		date_span.appendChild(document.createTextNode(item.date()));
		day_cell.appendChild(date_span);
	}
	row.appendChild(day_cell);

	// Create cell for event
	var event_cell = document.createElement('td')

	var tags_div = document.createElement('div');
	tags_div.setAttribute('class', 'tags');
	tags_div.setAttribute('id', 'tags' + item.id());
	var item_tags = item.tags();
	for (var j = 0; j < item_tags.length; j++) {
		var tag = tags.get(item_tags[j]);
		var tag_span = document.createElement('span');
		tag_span.setAttribute('id', 'itemtag' + tag.id() + '_' + item.id());
		tag_span.setAttribute('class', 'tag tag' + tag.style());
		tag_span.appendChild(document.createTextNode(tag.name()));
		tags_div.appendChild(tag_span);
	}
	var tags_img = document.createElement('img');
	tags_img.setAttribute('class', 'tagmenu');
	tags_img.setAttribute('src', index_url + 'images/arrow.gif');
	tags_img.setAttribute('id', 't' + item.id());
	tags_img.setAttribute('onclick', 'show_tags_menu(' + item.id() + ')');
	tags_div.appendChild(tags_img);
	event_cell.appendChild(tags_div);
	var event_div = document.createElement('div');
	event_div.setAttribute('class', 'event');
	event_div.setAttribute('id', 'event' + item.id());
	event_div.setAttribute('onclick', 'show_event_edit(' + item.id() + ')');
	event_div.appendChild(document.createTextNode(item.event()));
	event_cell.appendChild(event_div);
	row.appendChild(event_cell);

	// Create cell for location
	var location_cell = document.createElement('td');
	location_cell.setAttribute('onclick', 'show_location_edit(' + item.id() + ')');
	if (item.location())
		location_cell.appendChild(document.createTextNode(item.location()));
	row.appendChild(location_cell);

	// Create cell for start/end times
	var time_cell = document.createElement('td');
	time_cell.setAttribute('onclick', 'show_times_edit(' + item.id() + ')');
	if (item.start() != -1)
		time_cell.appendChild(document.createTextNode(item.start()));
	if (item.end() != -1) {
		time_cell.appendChild(document.createTextNode(String.fromCharCode(8211)));
		time_cell.appendChild(document.createTextNode(item.end()));
	}
	row.appendChild(time_cell);

	if (use_mark) {
		// Create cell for 'mark' button
		var mark_cell = document.createElement('td');
		var mark_button = document.createElement('input');
		mark_button.setAttribute('type', 'button');
		mark_button.setAttribute('class', 'mark');
		mark_button.setAttribute('value', '*');
		mark_button.setAttribute('onclick', 'toggle_mark(' + item.id() + ')');
		mark_button.setAttribute('id', 'mark' + item.id());
		mark_cell.appendChild(mark_button);
		row.appendChild(mark_cell);
	}
}

function populate_tag_selector()
{
	var tag_list = document.createElement('ul');
	tag_list.setAttribute('id', 'showtaglist');

	var taglist = tags.items_name();
	for (var i = 0; i < taglist.length; i++) {
		var tag = taglist[i];

		if (!used_tags.hasItem(tag.id()))
			continue;

		var tag_item = document.createElement('li');

		var tag_span = document.createElement('span');
		tag_span.setAttribute('id', 'showtag' + tag.id());
		var cls  = 'tag tag' + tag.style();
		var name = tag.name();
		if (show_tags.hasItem(tag.id()))
			name += String.fromCharCode(10004);
		else
			cls += ' unselected';
		tag_span.setAttribute('class', cls);
		tag_span.appendChild(document.createTextNode(name));
		tag_span.setAttribute('onclick', 'toggle_tag_display(' + tag.id() + ')');

		tag_item.appendChild(tag_span);
		tag_list.appendChild(tag_item);
	}

	var selector_area = document.getElementById('content_showtags');
	if (!selector_area) {
		create_extra_box('showtags', 'Tags');
		selector_area = document.getElementById('content_showtags');
	}

	remove_all_children(selector_area);
	selector_area.appendChild(tag_list);

	var edit_div = document.createElement('div');
	edit_div.setAttribute('style', 'text-align: right');
	var edit_link = document.createElement('a');
	edit_link.setAttribute('id', 'edittagslink');
	edit_link.setAttribute('href', 'javascript:edit_tags()');
	edit_link.appendChild(document.createTextNode('Edit Tags'));
	edit_div.appendChild(edit_link);
	selector_area.appendChild(edit_div);
}

function toggle_tag_display(id)
{
	var tag = $('#showtag' + id);

	if (!show_tags.hasItem(id))
		show_tags.setItem(id, 1);
	else
		show_tags.removeItem(id);

	populate();
}

function clear_tag_display()
{
	for (var id in show_tags.items) {
		show_tags.removeItem(id);
		$('#showtag' + id).addClass('unselected');
	}
	populate();
}

function show_tags_menu(id)
{
	hide_tags_menu();

	select_tags = id;

	var item  = items.get(id);
	var itags = item.tags();

	var div = document.createElement('div');
	div.setAttribute('id', 'picktags');

	var taglist = tags.items_name();
	for (var i = 0; i < taglist.length; i++) {
		var tag = taglist[i];

		var tag_row = document.createElement('div');
		var tag_box = document.createElement('input');
		tag_box.setAttribute('type', 'checkbox');
		tag_box.setAttribute('id', 'picktag' + tag.id());
		if (itags.indexOf(tag.id()) != -1)
			tag_box.setAttribute('checked', 'checked');
		tag_row.appendChild(tag_box);
		var tag_span = document.createElement('span');
		tag_span.setAttribute('class', 'tag tag' + tag.style());
		tag_span.appendChild(document.createTextNode(tag.name()));
		tag_row.appendChild(tag_span);
		div.appendChild(tag_row);
	}

	var save_button = document.createElement('button');
	save_button.setAttribute('onclick', 'save_item_tags(' + id + ')');
	save_button.appendChild(document.createTextNode('Save'));
	div.appendChild(save_button);

	document.body.appendChild(div);

	// Position it
	var img = $('#t' + id);
	img.addClass('show');
	var pos = img.offset();
	$('#picktags').css(img.offset());
}

function hide_tags_menu()
{
	var menu = document.getElementById('picktags');

	if (menu)
		menu.parentNode.removeChild(menu);

	if (select_tags)
		$('#t' + select_tags).removeClass('show');

	select_tags = 0;
}

function save_item_tags(id)
{
	var new_tags = [];

	// Go through all of the tags and figure out which ones are checked
	for (var i = 0; i < tags.items().length; i++) {
		var tag = tags.items()[i];
		var tag_elem = document.getElementById('picktag' + tag.id());
		if (tag_elem.checked)
			new_tags.push(tag.id());
	}

	// Make AJAX request to save tags
	var ajax = new AJAX(base_url, process);

	ajax.send('action=itemtags&id=' + id + '&tags=' + new_tags.join(','));
}

///////
// EDIT TAGS
///////
function hide_edit_tags()
{
	var div = document.getElementById('edittags');

	if (div)
		div.parentNode.removeChild(div);
}

function edit_tags()
{
	hide_edit_tags();

	var edit_tags_div = document.createElement('div');
	edit_tags_div.setAttribute('id', 'edittags');

	var form  = document.createElement('form');
	form.setAttribute('onsubmit', 'return save_tags()');

	var table = document.createElement('table');

	var taglist = tags.items_name();
	for (var i = 0; i < taglist.length; i++) {
		var tag = taglist[i];

		var row = document.createElement('tr');

		var name_cell = document.createElement('td');
		name_cell.setAttribute('id', 'tagname' + tag.id());
		name_cell.setAttribute('onclick', 'rename_tag(' + tag.id() + ')');
		var name_span = document.createElement('span');
		name_span.setAttribute('class', 'tag tag' + tag.style());
		name_span.setAttribute('id', 'edittagname' + tag.id());
		name_span.appendChild(document.createTextNode(tag.name()));
		name_cell.appendChild(name_span);
		row.appendChild(name_cell);

		var style_cell = document.createElement('td');
		var tag_span = document.createElement('span');
		tag_span.setAttribute('id', 'edittag' + tag.id());
		tag_span.setAttribute('class', 'dropdown tag tag' + tag.style());
		tag_span.setAttribute('style', 'cursor: pointer');
		tag_span.setAttribute('onmouseover', 'show_dropdown_arrow(' + tag.id() + ')');
		tag_span.setAttribute('onmouseout', 'hide_dropdown_arrow(' + tag.id() + ')');
		tag_span.setAttribute('onclick', 'show_styles_dropdown(' + tag.id() + ')');
		tag_span.appendChild(document.createTextNode(String.fromCharCode(8194)));
		style_cell.appendChild(tag_span);
		row.appendChild(style_cell);

		var remove_cell = document.createElement('tr');
		var remove_link = document.createElement('a');
		remove_link.setAttribute('href', 'javascript:remove_tag(' + tag.id() + ')');
		var remove_img = document.createElement('img');
		remove_img.setAttribute('src', index_url + 'images/remove.png');
		remove_link.appendChild(remove_img);
		remove_cell.appendChild(remove_link);
		row.appendChild(remove_cell);

		table.appendChild(row);
	}

	var add_row = document.createElement('tr');
	add_row.setAttribute('id', 'addtag');
	var add_cell = document.createElement('td');
	add_cell.setAttribute('colspan', '3');
	var add_link = document.createElement('a');
	add_link.setAttribute('href', 'javascript:add_tag_form()');
	add_link.appendChild(document.createTextNode('add tag'));
	add_cell.appendChild(add_link);
	add_row.appendChild(add_cell);
	table.appendChild(add_row);

	form.appendChild(table);
	edit_tags_div.appendChild(form);

	document.body.appendChild(edit_tags_div);

	// Position near the 'Edit tags' link
	var div   = $('#edittags');
	var link  = $('#edittagslink');
	var pos   = link.offset();
	pos.left -= div.width();
	div.css(pos);
}

function show_dropdown_arrow(id)
{
	var elem = $('#edittag' + id);

	elem.empty().text(String.fromCharCode(9663));
}

function hide_dropdown_arrow(id)
{
	var elem = $('#edittag' + id);

	elem.empty().text(String.fromCharCode(8194));
}

function show_styles_dropdown(id)
{
	hide_styles_dropdown();

	var tag = (id != -1) ? tags.get(id) : null;

	// Reset span's onclick
	var span = document.getElementById('edittag' + id);
	if (span)
		span.setAttribute('onclick', 'hide_styles_dropdown(' + id + ')');

	var div = document.createElement('div');
	div.setAttribute('id', 'styles');

	var table = document.createElement('table');
	table.setAttribute('id', 'styletable');

	for (var i = 0; i < 4; i++) {
		var row = document.createElement('tr');
		for (var j = 1; j <= 6; j++) {
			var style = (6 * i) + j;
			var cell = document.createElement('td');
			var span = document.createElement('span');
			span.setAttribute('style', 'cursor: pointer; display: block; width: 1em');
			span.setAttribute('class', 'tag tag' + style);
			if ((tag && tag.style() == style) || (!tag && new_tag_style == style))
				span.appendChild(document.createTextNode(String.fromCharCode(10004)));
			else
				span.appendChild(document.createTextNode('a'));
			span.setAttribute('onclick', 'set_tag_style(' + id + ',' + style + ')');
			cell.appendChild(span);
			row.appendChild(cell);
		}
		table.appendChild(row);
	}
	// Add 'no style' row
	var row  = document.createElement('tr');
	var cell = document.createElement('td');
	cell.setAttribute('colspan', '6');
	cell.setAttribute('onclick', 'set_tag_style(' + id + ',0)');
	if ((!tag && new_tag_style == 0) || (tag && tag.style() == 0))
		cell.appendChild(document.createTextNode(String.fromCharCode(10004)));
	cell.appendChild(document.createTextNode(' No style'));
	row.appendChild(cell);
	table.appendChild(row);

	div.appendChild(table);

	document.body.appendChild(div);

	var styles = $('#styles');
	var edit   = $('#edittag' + id);
	var pos    = edit.offset();
	pos.left  -= styles.width() / 2;
	pos.top   += edit.height();
	styles.css(pos);
}

function hide_styles_dropdown(id)
{
	var div = document.getElementById('styles');

	if (div)
		div.parentNode.removeChild(div);

	if (id) {
		// Restore onclick handler
		var span = document.getElementById('edittag' + id);
		if (span)
			span.setAttribute('onclick', 'show_styles_dropdown(' + id + ')');
	}
}

function set_tag_style(tag_id, style)
{
	hide_styles_dropdown(tag_id);

	if (tag_id == -1) {
		new_tag_style = style;
		$('#edittag-1').removeClass().addClass('tag tag' + style);
		document.getElementById('addtagname').focus();
	} else {
		var tag = tags.get(tag_id);
		tag.set_style(style);
	
		var ajax = new AJAX(base_url, load_tags);

		ajax.send('action=savetag&id=' + tag_id + '&style=' + ((style == 0) ? -1 : style));

		// Refresh tags
		refresh_tags();
	}
}

function refresh_tags()
{
	var alltags = document.getElementsByClassName('tag');

	var len = alltags.length;
	for (var i = 0; i < len; i++) {
		var id = alltags[i].getAttribute('id');
		if (!id)
			continue;
		var t = $('#' + id);
		if (!t)
			continue;

		var dropdown = 0;
		if (t.hasClass('dropdown'))
			dropdown = 1;

		var classes = t.get(0).className.split(" ");
		t.removeClass();
		for (var j = 0; j < classes.length; j++) {
			if (classes[j].match(/tag\d+/)) {
				var idc = id;
				var tid = idc.replace(/(.+?)(\d+)(_(.+))?/, "$2");
				var style = tags.get(tid).style();
				t.addClass('tag' + style);
				if (!dropdown)
					t.empty().text(tags.get(tid).name());
			} else
				t.addClass(classes[j]);
		}
	}
}

function rename_tag(id)
{
	hide_rename_tag();

	// Get cell
	var cell = document.getElementById('tagname' + id);

	// Suppress onclick handler
	cell.setAttribute('onclick', 'return false');

	// Remove existing content
	remove_all_children(cell);

	// Populate with the edit fields
	var id_elem = document.createElement('input');
	id_elem.setAttribute('type', 'hidden');
	id_elem.setAttribute('id', 'edittagid');
	id_elem.setAttribute('value', id);
	cell.appendChild(id_elem);

	var tag = tags.get(id);

	var name_elem = document.createElement('input');
	name_elem.setAttribute('type', 'text');
	name_elem.setAttribute('class', 'tagname');
	name_elem.setAttribute('id', 'edittagname');
	name_elem.setAttribute('value', tag.name());
	cell.appendChild(name_elem);

	name_elem.focus();
}

function hide_rename_tag()
{
	if (!document.getElementById('edittagid'))
		return;

	var id = parseInt(document.getElementById('edittagid').value);

	if (id == -1)
		hide_add_tag();
	else {
		// Get affected cell
		var cell = document.getElementById('tagname' + id);

		// Restore onclick handler
		cell.setAttribute('onclick', 'rename_tag(' + id + ')');

		// Restore appearance
		remove_all_children(cell);

		var tag  = tags.get(id);

		var span = document.createElement('span');
		span.setAttribute('class', 'tag tag' + tag.style());
		span.appendChild(document.createTextNode(tag.name()));
		cell.appendChild(span);
	}
}

function add_tag_form()
{
	// Get row with 'add tag' link
	var row = document.getElementById('addtag');

	// Empty it out
	remove_all_children(row);

	new_tag_style = 1;

	// Add fields for info
	var name_cell = document.createElement('td');
	var name_box  = document.createElement('input');
	name_box.setAttribute('type', 'text');
	name_box.setAttribute('class', 'tagname');
	name_box.setAttribute('id', 'addtagname');
	name_cell.appendChild(name_box);
	var id_elem = document.createElement('input');
	id_elem.setAttribute('type', 'hidden');
	id_elem.setAttribute('id', 'edittagid');
	id_elem.setAttribute('value', '-1');
	name_cell.appendChild(id_elem);
	row.appendChild(name_cell);

	var style_cell = document.createElement('td');
	var tag_span = document.createElement('span');
	tag_span.setAttribute('id', 'edittag-1');
	tag_span.setAttribute('class', 'dropdown tag tag1');
	tag_span.setAttribute('style', 'cursor: pointer');
	tag_span.setAttribute('onmouseover', 'show_dropdown_arrow(-1)');
	tag_span.setAttribute('onmouseout', 'hide_dropdown_arrow(-1)');
	tag_span.setAttribute('onclick', 'show_styles_dropdown(-1)');
	tag_span.appendChild(document.createTextNode(String.fromCharCode(8194)));
	style_cell.appendChild(tag_span);
	row.appendChild(style_cell);

	name_box.focus();
}

function hide_add_tag()
{
	var row = document.getElementById('addtag');

	remove_all_children(row);

	var cell = document.createElement('td');
	cell.setAttribute('colspan', '4');

	var link = document.createElement('a');
	link.setAttribute('href', 'javascript:add_tag_form()');
	link.appendChild(document.createTextNode('add tag'));
	cell.appendChild(link);
	row.appendChild(cell);
}

function save_tags()
{
	var ajax = new AJAX(base_url, function(xml) { load_tags(xml); edit_tags(); refresh_tags(); populate_tag_selector(); }); 

	if (!document.getElementById('edittagid'))
		return false;

	var id = parseInt(document.getElementById('edittagid').value);

	// Figure out if we're adding a new tag or updating an existing one
	if (id == -1) {
		// Adding new tag

		var name = document.getElementById('addtagname').value;

		if (name.trim()) {
			ajax.send('action=addtag&name=' + name + '&style=' + new_tag_style);
			hide_add_tag();
		}
	} else {
		// Updating existing tag

		var name = document.getElementById('edittagname').value;

		if (name.trim()) {
			ajax.send('action=savetag&id=' + id + '&name=' + name);
			hide_rename_tag();
		}
	}

	return false;
}

function remove_tag(id)
{
	var tag = tags.get(id);

	if (confirm("Are you sure you want to remove the tag '" + tag.name() + "'?")) {
		var week = document.getElementById('week').value;
		var ajax = new AJAX(base_url, function(xml) { process(xml); edit_tags(); populate_tag_selector(); });
		ajax.send('action=removetag&id=' + id + '&week=' + week);
	}
}

///////
// HIGHLIGHT CURRENT DAY'S ITEMS
///////
function highlight()
{
	var curr_week = false;
	var old_week  = false;

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
		else if (today >= next_week)
			old_week = true;
	}

	if (curr_week) {
		var today = (new Date()).getDay();

		// Get table
		var table = document.getElementById('content');

		var rows = table.getElementsByTagName('tr');
		for (var i = 1; i < rows.length; i++) {
			var id  = rows[i].getAttribute('id');
			var row = $('#' + id);

			var item = items.get(id.replace(/item/, ''));

			var done = row.hasClass('done');
			var mark = row.hasClass('mark');

			row.removeClass();
			if (item.day() == today)
				row.addClass('today');
			else if (item.day() >= 0 && item.day() < today)
				row.addClass('past');
			else if (item.day() >= 0 && item.day() < 7)
				row.addClass('future');
			else
				row.addClass('undated');

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
			var id  = rows[i].getAttribute('id');
			var row = $('#' + id);

			var done = row.hasClass('done');
			var mark = row.hasClass('mark');

			row.removeClass();
			if (old_week)
				row.addClass('past');
			else
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

		if (box)
			box.checked = done;
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
		for (var i = 0; i < len; i++)
			row.removeChild(row.getElementsByTagName('td')[0]);
		var cell = document.createElement('td');
		cell.setAttribute('colspan', use_mark ? '6' : '5');
		cell.setAttribute('style', 'font-style: italic; text-align: center');
		cell.innerHTML = 'Processing...';
		row.appendChild(cell);

		var ajax = new AJAX(base_url, process);

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

	// Make sure the important fields have values (Todo #1367)
	if (!week || !event) {
		alert("Missing some key information!");
		return;
	}

	var ajax = new AJAX(base_url, process);

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

///////
// EDITING
///////

function show_day_edit(id)
{
	// Clear other edits
	clear_edits(id);

	// Get item
	var item = items.get(id);

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

	currently_editing = id;

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
		if (i == item.day())
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

	var ajax = new AJAX(base_url, process);

	ajax.send('action=day&id=' + id + '&day=' + newday);
}

function show_event_edit(id)
{
	// Clear other edits
	clear_edits(id);

	// Get item
	var item = items.get(id);

	if (!item)
		return;

	// Create submit button
	create_hidden_submit();

	// Get the row we're editing in
	var row  = $('#item' + id);

	// Get the event cell
	var cell = $('#item' + id + ' > td:eq(2)');

	var event = $('#event' + id);

	// Make sure we don't call this function again while we're editing
	event.get(0).setAttribute('onclick', 'return false;');

	// Save tags, if any
	var itags = $('#tags' + id);

	currently_editing = id;

	// Don't indicate done when editing the event
	cell.addClass('nodec');

	// Create a new textbox
	var textbox = document.createElement('input');
	textbox.setAttribute('type', 'text');
	textbox.setAttribute('name', 'event');
	textbox.setAttribute('id', 'event');
	var width = 97 - ((itags.width() / cell.width()) * 100);
	textbox.style.width = width + '%';
	textbox.value = item.event();

	event.empty();
	event.append(textbox);

	// Focus the new box
	textbox.focus();

	// Select the text in the box
	textbox.select();
}

function show_location_edit(id)
{
	// Clear other edits
	clear_edits(id);

	// Get item
	var item = items.get(id);

	if (!item)
		return;

	// Create submit button
	create_hidden_submit();

	// Get the location cell
	var cell = $('#item' + id + '>td:eq(3)');

	// Make sure we don't call this function again if we click in the textbox
	cell.get(0).setAttribute('onclick', 'return false;');

	// Don't strike through the textbox
	cell.addClass('nodec');

	currently_editing = id;

	// Create new textbox
	var textbox = document.createElement('input');
	textbox.setAttribute('type', 'text');
	textbox.setAttribute('name', 'location');
	textbox.setAttribute('id', 'location');
	textbox.style.width = '97%';
	textbox.value = item.location();

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

	// Get this item
	var item = items.get(id);

	if (!item)
		return;

	// Create submit button
	create_hidden_submit();

	// Get the times cell
	var cell = $('#item' + id + '>td:eq(4)');

	// Make sure we don't call this function again while we're editing
	cell.get(0).setAttribute('onclick', 'return false;');

	// Don't show strikethrough while editing
	cell.addClass('nodec');

	currently_editing = id;

	// Create a new start time textbox
	var startbox = document.createElement('input');
	startbox.setAttribute('type', 'text');
	startbox.setAttribute('name', 'start');
	startbox.setAttribute('id', 'start');
	startbox.setAttribute('class', 'time');

	if (item.start() != -1)
		startbox.value = item.start();

	// Create a new end time textbox
	var endbox = document.createElement('input');
	endbox.setAttribute('type', 'text');
	endbox.setAttribute('name', 'end');
	endbox.setAttribute('id', 'end');
	endbox.setAttribute('class', 'time');

	if (item.end() != -1)
		endbox.value = item.end();

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
	var ajax = new AJAX(base_url, process);

	ajax.send('action=done&id=' + id);

	// Get the current row
	var row = document.getElementById('item' + id);

	// Create spinner
	var spinner = document.createElement('img');
	spinner.setAttribute('src', index_url + 'images/processing.gif');

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
		var ajax = new AJAX(base_url, process);
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

	var item = items.get(currently_editing);
	var row  = document.getElementById('item' + currently_editing);

	populate_row(row, item);

	currently_editing = 0;

	highlight();
	sync_boxes();
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


function load_template()
{
	// Get week ID
	var week = document.getElementById('week').value;

	if (!week)
		return;

	// Construct URL
	var url = index_url + '?act=template;week=' + week;

	// Go to new URL
	window.location.href = url;
}

function move_incomplete()
{
	// Get week ID
	var week = document.getElementById('week').value;

	// Create AJAX object
	var ajax = new AJAX(base_url, process);

	// Make AJAX request
	ajax.send('action=move&week=' + week);
}

function create_extra_box(id, title, state)
{
	// Get 'extra' container
	var extra = document.getElementById('extra');

	var container = document.createElement('div');
	container.setAttribute('class', 'container');
	container.setAttribute('id', id);

	var header = document.createElement('div');
	header.setAttribute('class', 'header');
	header.setAttribute('id', 'header_' + id);
	header.appendChild(document.createTextNode(title));
	container.appendChild(header);

	var content = document.createElement('div');
	content.setAttribute('class', 'content');
	content.setAttribute('id', 'content_' + id);

	container.appendChild(content);

	extra.appendChild(container);

	return container;
}

function move_incomplete_timeout(ajax)
{
	ajax.abort();
}

///////
// TOGGLE COLOR KEY
///////
function toggle_color_key()
{
	var key = $('#colorkey');
	var link = $('#showcolorkey');

	if (key.hasClass('hidden')) {
		key.removeClass('hidden');
		link.empty().text('Hide color key');
	} else {
		key.addClass('hidden');
		link.empty().text('Show color key');
	}
}

///////
// HELPER FUNCTIONS
///////

function remove_all_children(elem)
{
	if (!elem)
		return;

	var len = elem.childNodes.length;
	for (var i = 0; i < len; i++)
		elem.removeChild(elem.childNodes[0]);
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

