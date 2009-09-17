var template     = 0;
var items        = new Items();
var tags         = new Tags();
var used_tags    = new Hash();
var show_tags    = new Hash();
var extra_states = new Hash();
var menu_stack   = [];

var options_box  = null;
var tag_sel_box  = null;

var pick_tags_popup = null;
var edit_tags_popup = null;
var tag_style_popup = null;

// Since we'll only allow edits to one thing at a time,
// save the current values when we edit so that they can be restored
// if the user cancels or edits another one
var currently_editing = 0;
var select_tags       = 0;
var new_tag_style     = 1;

///////
// INITIALIZATION
///////

// Refresh the highlighting every 5 minutes (30000 ms)
$(document).ready(function() { setInterval("highlight()", 300000); });

// Add handler for keyboard input
if (window.addEventListener)
	window.addEventListener('keydown', key_handler, false);
else if (window.attachEvent)
	window.document.attachEvent('onkeydown', key_handler);

///////
// KEYBOARD HANDLER
///////
function key_handler(event)
{
	event = (event) ? event : ((window.event) ? event : null);

	if (event) {
		key = (event.charCode) ? event.charCode : ((event.which) ? event.which : event.keyCode);
		if (event.altKey && String.fromCharCode(key).toLowerCase() == 'n') // Alt+N (new)
			new_item_form();
		else if (key == 27)
			clear_edits();
  }
}

///////
// SHOW OPTIONS
///////
function show_options()
{
	// Check if we already have this set up; if we do, no need to do this again
	if (options_box)
		return;

	options_box = new Box('options', 'Options', 'extra');

	var options = [
		{ element: 'li', children: [ { element: 'a', href: 'javascript:load_template()', text: 'Load template' } ] },
		{ element: 'li', children: [ { element: 'a', href: 'javascript:move_incomplete()', text: 'Move unfinished items to next week' } ] },
		{ element: 'li', children: [ { element: 'a', href: index_url + 'template/', text: 'Edit template' } ] }
	];
	if (use_mark)
		options.push({ element: 'li', children: [ {element: 'a', id: 'showcolorkey', href: 'javascript:toggle_color_key()', text: 'Show color key' } ] });

	var options_list = create_element({
		element: 'ul', id: 'optionslist', children: options
	});

	options_box.content.appendChild(options_list);
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
		var ok    = (tlen == 0 && (show_tags.length == 0 || show_tags.hasItem(0)))  ? true : false;
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

	// If list is empty, show a message to that effect
	if (things.length == 0) {
		tbody.appendChild(create_element({
			element: 'tr', id: 'empty',
			children: [
				{ element: 'td', colspan: (use_mark == 1) ? 6 : 5, text: 'No items for this week' }
			]
		}));
	}

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
	row.appendChild(create_element({
		element: 'td', cssclass: 'done',
		children: [
			{ element: 'input', type: 'checkbox', id: 'done' + item.id(), onclick: 'toggle_done(' + item.id() + ')' }
		]
	}));

	// Create cell for day
	var day_cell = {
		element: 'td', cssclass: 'day', onclick: 'show_day_edit(' + item.id() + ')',
		text: get_day_from_value(item.day())
	};
	if (show_date)
		day_cell.children = [ { element: 'span', cssclass: 'date', text: item.date() } ];
	row.appendChild(create_element(day_cell));

	// Create cell for event
	var event_cell = {
		element: 'td', cssclass: 'event',
		children: [
			{ element: 'div', cssclass: 'tags', id: 'tags' + item.id(), children: [] }
		]
	};

	var tags_elems = {
		element: 'div', cssclass: 'tags', id: 'tags' + item.id(), children: []
	};

	var item_tags = item.tags();
	for (var j = 0; j < item_tags.length; j++) {
		var tag = tags.get(item_tags[j]);
		event_cell.children[0].children.push({ element: 'span', id: 'itemtag' + tag.id() + '_' + item.id(), cssclass: 'tag tag' + tag.style(), text: tag.name() });
	}

	event_cell.children[0].children.push({ element: 'img', cssclass: 'tagmenu', src: images_url + '/arrow.gif', id: 't' + item.id(), onclick: 'show_tags_menu(' + item.id() + ')' });
	event_cell.children.push({ element: 'div', cssclass: 'event', id: 'event' + item.id(), onclick: 'show_event_edit(' + item.id() + ')', text: item.event() });
	row.appendChild(create_element(event_cell));

	// Create cell for location
	row.appendChild(create_element({ element: 'td', cssclass: 'location', onclick: 'show_location_edit(' + item.id() + ')', text: item.location() }));

	// Create cell for start/end times
	var time_cell = {
		element: 'td', cssclass: 'times', onclick: 'show_times_edit(' + item.id() + ')',
		children: []
	}
	if (item.start() != -1)
		time_cell.children.push({ element: 'text', text: item.start() });
	if (item.end() != -1)
		time_cell.children.push({ element: 'text', text: String.fromCharCode(8211) + item.end() });
	row.appendChild(create_element(time_cell));

	if (use_mark)
		// Create cell for 'mark' button
		row.appendChild(create_element({
			element: 'td', cssclass: 'mark nodec',
			children: [
				{ element: 'input', type: 'button', cssclass: 'mark', value: '*', onclick: 'toggle_mark(' + item.id() + ')', id: 'mark' + item.id() }
			]
		}));
}

function populate_tag_selector()
{
	var tag_list = {
		element: 'ul', id: 'showtaglist', children: [
			{
				element: 'span', id: 'showtag0', onclick: 'toggle_tag_display(0)',
				cssclass: 'tag' + (show_tags.hasItem(0) ? '' : ' unselected'),
				text: '[none]' + (!show_tags.hasItem(0) ? '' : String.fromCharCode(10004))
			}
		]
	};

	var taglist = tags.items_name();
	for (var i = 0; i < taglist.length; i++) {
		var tag = taglist[i];

		if (!used_tags.hasItem(tag.id()))
			continue;

		tag_list.children.push({
			element: 'li',
			children: [ {
				element: 'span', id: 'showtag' + tag.id(), onclick: 'toggle_tag_display(' + tag.id() + ')',
				cssclass: 'tag tag' + tag.style() + (show_tags.hasItem(tag.id()) ? '' : ' unselected'),
				text: tag.name() + (!show_tags.hasItem(tag.id()) ? '' : String.fromCharCode(10004))
			} ]
		});
	}

	if (!tag_sel_box)
		tag_sel_box = new Box('showtags', 'Tags', 'extra');

	remove_all_children(tag_sel_box.content);
	tag_sel_box.content.appendChild(create_element(tag_list));
	tag_sel_box.content.appendChild(create_element({
		element: 'div', style: 'text-align: right',
		children: [
			{ element: 'a', id: 'edittagslink', href: 'javascript:edit_tags()', text: 'Edit Tags' }
		]
	}));
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

	pick_tags_popup = new Popup('picktags', 'Select tags', { onclose: hide_tags_menu });

	var content = {
		element: 'div', id: 'picktagslist', children: []
	};

	var taglist = tags.items_name();
	for (var i = 0; i < taglist.length; i++) {
		var tag = taglist[i];

		content.children.push({
			element: 'div',
			children: [
				{ element: 'input', type: 'checkbox', id: 'picktag' + tag.id(), checked: (itags.indexOf(tag.id()) != -1) },
				{ element: 'span', cssclass: 'tag tag' + tag.style(), text: tag.name() }
			]
		});
	}

	pick_tags_popup.content.appendChild(create_element(content));

	pick_tags_popup.content.appendChild(create_element({
		element: 'button', id: 'savetags' + id, onclick: 'save_item_tags(' + id + ')', text: 'Save'
	}));

	// Position it
	var img = $('#t' + id);
	img.addClass('show');
	var pos = img.offset();
	$('#popup_picktags').css(img.offset());
}

function hide_tags_menu()
{
	if (pick_tags_popup) {
		pick_tags_popup.close();
		delete pick_tags_popup;
	}

	if (select_tags)
		$('#t' + select_tags).removeClass('show');

	select_tags = 0;
}

function save_item_tags(id)
{
	// Disable the 'save' button (Todo #1473)
	var save_button = document.getElementById('savetags' + id);
	save_button.setAttribute('disabled', 'disabled');
	remove_all_children(save_button);
	save_button.appendChild(document.createTextNode('Saving...'));

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

	ajax.send({
		action: 'itemtags',
		id: id,
		tags: new_tags.join(',')
	});
}

///////
// EDIT TAGS
///////
function edit_tags()
{
	if (edit_tags_popup) {
		edit_tags_popup.close();
		delete edit_tags_popup;
	}

	edit_tags_popup = new Popup('edittags', 'Edit Tags');

	var form = {
		element: 'form', onsubmit: 'return save_tags()',
		children: [
			{ element: 'table', children: [] }
		]
	};

	var table = form.children[0].children;

	var taglist = tags.items_name();
	for (var i = 0; i < taglist.length; i++) {
		var tag = taglist[i];

		table.push({
			element: 'tr',
			children: [
				{
					element: 'td', id: 'tagname' + tag.id(), onclick: 'rename_tag(' + tag.id() + ')', cssclass: 'tagname',
					children: [
						{ element: 'span', cssclass: 'tag tag' + tag.style(), id: 'edittagname' + tag.id(), text: tag.name() }
					]
				},
				{
					element: 'td',
					children: [
						{
							element: 'span', id: 'edittag' + tag.id(), cssclass: 'dropdown tag tag' + tag.style(), style: 'cursor: pointer', text: String.fromCharCode(8194),
							onmouseover: 'show_dropdown_arrow(' + tag.id() + ')',
							onmouseout: 'hide_dropdown_arrow(' + tag.id() + ')',
							onclick: 'show_styles_dropdown(' + tag.id() + ')'
						}
					]
				},
				{
					element: 'td',
					children: [
						{
							element: 'a', href: 'javascript:remove_tag(' + tag.id() + ')',
							children: [
								{ element: 'img', src: images_url + '/remove.png' }
							]
						}
					]
				}
			]
		});
	}

	table.push({
		element: 'tr', id: 'addtag',
		children: [
			{
				element: 'td', colspan: 3,
				children: [
					{ element: 'a', href: 'javascript:add_tag_form()', text: 'Add tag' }
				]
			}
		]
	});

	edit_tags_popup.content.appendChild(create_element(form));

	// Position near the 'Edit tags' link
	var div   = $('#popup_edittags');
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

	tag_style_popup = new Popup('tagstyles', 'Pick color', { onclose: hide_styles_dropdown, oncloseparam: id });

	var table = { element: 'table', id: 'styletable', children: [] };

	for (var i = 0; i < 4; i++) {
		var row = { element: 'tr', children: [] };
		for (var j = 1; j <= 6; j++) {
			var style = (6 * i) + j;

			row.children.push({
				element: 'td',
				children: [
					{
						element: 'span', style: 'cursor: pointer; display: block; width: 1em', cssclass: 'tag tag' + style, onclick: 'set_tag_style(' + id + ',' + style + ')',
						text: ((tag && tag.style() == style) || (!tag && new_tag_style == style)) ? String.fromCharCode(10004) : 'a'
					}
				]
			});
		}
		table.children.push(row);
	}

	// Add 'no style' row
	table.children.push({
		element: 'tr',
		children: [
			{
				element: 'td', colspan: 6, onclick: 'set_tag_style(' + id + ',0)',
				text: (((!tag && new_tag_style == 0) || (tag && tag.style() == 0)) ? String.fromCharCode(10004) : '') + ' No style'
			}
		]
	});

	tag_style_popup.content.appendChild(create_element(table));

	var styles = $('#popup_tagstyles');
	var edit   = $('#edittag' + id);
	var pos    = edit.offset();
	pos.left  -= styles.width() / 2;
	pos.top   += edit.height();
	styles.css(pos);
}

function hide_styles_dropdown(id)
{
	if (id) {
		// Restore onclick handler
		var span = document.getElementById('edittag' + id);
		if (span)
			span.setAttribute('onclick', 'show_styles_dropdown(' + id + ')');
	}
}

function set_tag_style(tag_id, style)
{
	if (tag_style_popup) {
		tag_style_popup.close();
		delete tag_style_popup;
	}

	if (tag_id == -1) {
		new_tag_style = style;
		$('#edittag-1').removeClass().addClass('tag tag' + style);
		document.getElementById('addtagname').focus();
	} else {
		var tag = tags.get(tag_id);
		tag.set_style(style);
	
		var ajax = new AJAX(base_url, load_tags);

		ajax.send({
			action: 'savetag',
			id: tag_id,
			style: ((style == 0) ? -1 : style)
		});

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
	cell.appendChild(create_element({
		element: 'input', type: 'hidden', id: 'edittagid', value: id
	}));

	var tag = tags.get(id);

	cell.appendChild(create_element({
		element: 'input', type: 'text', cssclass: 'tagname', id: 'edittagname', value: tag.name()
	}));

	document.getElementById('edittagname').focus();
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

		cell.appendChild(create_element({
			element: 'span', cssclass: 'tag tag' + tag.style(), text: tag.name()
		}));
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
	row.appendChild(create_element({
		element: 'td',
		children: [
			{ element: 'input', type: 'text', cssclass: 'tagname', id: 'addtagname' },
			{ element: 'input', type: 'hidden', id: 'edittagid', value: '-1' }
		]
	}));

	row.appendChild(create_element({
		element: 'td',
		children: [
			{
				element: 'span', id: 'edittag-1', cssclass: 'dropdown tag tag1', style: 'cursor: pointer',
				onmouseover: 'show_dropdown_arrow(-1)',
				onmouseout: 'hide_dropdown_arrow(-1)',
				onclick: 'show_styles_dropdown(-1)',
				text: String.fromCharCode(8194)
			}
		]
	}));

	document.getElementById('addtagname').focus();
}

function hide_add_tag()
{
	var row = document.getElementById('addtag');

	remove_all_children(row);

	row.appendChild(create_element({
		element: 'td', colspan: 4,
		children: [
			{ element: 'a', href: 'javascript:add_tag_form()', text: 'Add tag' }
		]
	}));
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
			ajax.send({
				action: 'addtag',
				name: name,
				style: new_tag_style
			});
			hide_add_tag();
		}
	} else {
		// Updating existing tag

		var name = document.getElementById('edittagname').value;

		if (name.trim()) {
			ajax.send({
				action: 'savetag',
				id: id,
				name: name
			});
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
		ajax.send({
			action: 'removetag',
			id: id,
			week: week
		});
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

		// Build param object
		var params = {
			action: 'save',
			id: currently_editing,
			changed: changed
		};
		if (update_event)
			params['event'] = event;
		if (update_location)
			params['location'] = location;
		if (update_times) {
			params['start'] = start;
			params['end']   = end;
		}

		// Replace the row with a processing message
		var row = document.getElementById('item' + currently_editing);
		var len = row.getElementsByTagName('td').length;
		for (var i = 0; i < len; i++)
			row.removeChild(row.getElementsByTagName('td')[0]);

		row.appendChild(create_element({ element: 'td', colspan: use_mark ? 6 : 5, cssclass: 'nodec', style: 'font-style: italic; text-align: center', text: 'Processing...' }));

		var ajax = new AJAX(base_url, process);

		ajax.send(params);
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
	var row = {
		element: 'tr', id: 'newrow',
		children: [
			// Day column
			{
				element: 'td', colspan: 2,
				children: [
					{ element: 'select', id: 'newday', children: [] }
				]
			},
			// Event column
			{
				element: 'td',
				children: [
					{ element: 'input', type: 'text', id: 'newevent', style: 'width: 97%' }
				]
			},
			// Location column
			{
				element: 'td',
				children: [
					{ element: 'input', type: 'text', id: 'newlocation', style: 'width: 97%' }
				]
			},
			// Times column
			{
				element: 'td',
				children: [
					{ element: 'input', type: 'text', id: 'newstart', cssclass: 'time' },
					{ element: 'text', text: String.fromCharCode(8211) },
					{ element: 'input', type: 'text', id: 'newend', cssclass: 'time' }
				]
			}
		]
	}

	// Create dropdown for day
	var dropdown = row.children[0].children[0].children;

	// Create options for each day choice
	for (var i = -1; i < 7; i++) {
		var day = get_day_from_value(i);
		if (!template && i >= 0 && dates[i])
			day += dates[i].strftime(date_format);
		dropdown.push({
			element: 'option', value: i, text: day
		});
	}

	// Add column for "mark", if that feature is used
	if (use_mark)
		row.children.push({ element: 'td', text: ' ' });

	// Add the new row to the table
	tbody.appendChild(create_element(row));

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

	ajax.send({
		action: 'add',
		week: week,
		day: day,
		event: event,
		location: location,
		start: start,
		end: end
	});

	// Provide some feedback to let the user know that something's happening
	var row = document.getElementById('newrow');
	var parent = row.parentNode;
	parent.removeChild(row);

	parent.appendChild(create_element({
		element: 'tr', id: 'newrow', cssclass: 'front',
		children: [
			{ element: 'td', colspan: use_mark ? 6 : 5, style: 'font-style: italic; text-align: center', text: 'Processing...' }
		]
	}));
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
	var dropdown = {
		element: 'select', id: 'day', onchange: 'save_day(' + id + ')',
		children: [ ]
	};

	// Create options for each day choice
	for (var i = -1; i < 7; i++) {
		dropdown.children.push({
			element: 'option', value: i, text: get_day_from_value(i) + ((!template && i >= 0 && dates[i]) ? dates[i].strftime(date_format) : ''), selected: (i == item.day())
		});
	}

	dropdown.children.push({
		element: 'option', value: '8', text: '->'
	});

	cell.append(create_element(dropdown));
	document.getElementById('day').focus();
}

function save_day(id)
{
	// Get the day box
	var daybox = document.getElementById('day');

	var newday = daybox.value;

	var ajax = new AJAX(base_url, process);

	ajax.send({
		action: 'day',
		id: id,
		day: newday
	});

	// Disable dropdown while processing (Todo #1530)
	daybox.setAttribute('disabled', 'disabled');
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
	var width = 97 - ((itags.width() / cell.width()) * 100);
	var textbox = create_element({
		element: 'input', type: 'text', id: 'event', style: 'width: ' + width + '%', value: item.event()
	});

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
	var textbox = create_element({
		element: 'input', type: 'text', id: 'location', style: 'width: 97%', value: item.location()
	});

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
	var startbox = create_element({
		element: 'input', type: 'text', id: 'start', cssclass: 'time', value: (item.start() != -1) ? item.start() : ''
	});

	// Create a new end time textbox
	var endbox = create_element({
		element: 'input', type: 'text', id: 'end', cssclass: 'time', value: (item.end() != -1) ? item.end() : ''
	});

	cell.empty();
	cell.append(startbox);
	cell.append(create_element({ element: 'span', text: String.fromCharCode(8211) }));
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

	ajax.send({
		action: 'done',
		id: id
	});

	// Get the current row
	var row = document.getElementById('item' + id);

	// Create spinner
	var spinner = create_element({ element: 'img', src: images_url + '/processing.gif' });

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
		ajax.send({
			action: 'mark',
			id: id
		});

		// Get the current row
		var row = document.getElementById('item' + id);

		// Create spinner
		var spinner = create_element({ element: 'img', src: images_url + '/processing.gif' });

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

	var ajax = new AJAX(base_url, process);

	ajax.send({
		action: 'delete',
		id: id
	});

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

	var elem = {
		element: 'input', type: 'submit', id: 'submit', style: 'display: none'
	};

	button = create_element(elem);

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
	ajax.send({
		action: 'move',
		week: week
	});
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

if (!Array.indexOf) {
	Array.prototype.indexOf = function(obj) {
		for (var i = 0; i < this.length; i++)
			if(this[i] == obj)
				return i;
		return -1;
	}
}

