# Review mode

Every word the review widget shows on the web review build (npm run web:review): the Feedback button, the docked panel, and the inline copy editor. The public site never loads these strings. Headings, labels, and buttons are in title case, by the owner's decision. A missing value reads the Not Found label from the global label dictionary.

## `panel`

Where: the docked Feedback panel.

- `entry`: Feedback
- `title`: Feedback
- `close`: Close
- `note_label`: Note
- `note_placeholder`: Say what is wrong or what should change.
- `step_label`: Journey Step
- `step_choose`: Choose A Step
- `step_none`: This Page Has No Step
- `step_group_page`: This Page
- `step_group_all`: All Steps
- `spots_heading`: Spots On The Page
- `spots_hint`: Click the page to add a numbered pin. Add as many as the note needs. With none, the ticket is about the whole page. Double click page copy to edit it here.
- `spots_empty`: No spots yet.
- `spot_show`: Show spot {{n}} on the page
- `spot_remove`: Remove
- `spot_remove_aria`: Remove spot {{n}}
- `spot_pin_aria`: Spot {{n}}
- `categories_heading`: Categories
- `categories_unavailable`: Categories are unavailable: the review server did not answer.
- `components_heading`: Design System Components
- `components_none`: None linked.
- `components_label`: Linked components
- `component_add_placeholder`: Add A Component
- `component_add`: Add
- `component_open_aria`: {{name}}, opens the design system file in a new tab
- `component_obsidian`: Open In Obsidian
- `component_remove_aria`: Remove {{name}}
- `content_heading`: Content Entries
- `content_label`: Linked content entries
- `recorded_heading`: Recorded For This Step
- `recorded_none`: Nothing yet.
- `recorded_item`: {{id}} {{status}}: {{title}}
- `image_page`: Page Image
- `image_spot`: Spot {{n}} Image
- `send`: Send

## `messages`

Where: the status line at the foot of the panel.

- `note_required`: Write a note first.
- `step_required`: Choose a journey step first. Feedback is recorded against a step.
- `sending`: Sending.
- `registered`: Registered as {{id}} and accepted. Screenshots are being taken.
- `redacted`: A value shaped like a secret was removed.
- `not_recorded`: Not recorded. {{reason}}
- `spot_added`: Spot {{n}} added. Click the page to add another.
- `spot_removed`: Spot removed.
- `component_unknown`: That is not a known component. Choose one from the list.
- `copy_multi`: This text is built from several copy entries or filled from data, so it cannot be edited in place.
- `copy_none`: This is not page copy, so it cannot be edited here. It comes from the data or the page layout.
- `edited`: Edited in place and recorded as {{id}}, accepted.

## `elements`

Where: the plain name of the kind of element a pin points at.

- `h1`: Heading
- `h2`: Heading
- `h3`: Heading
- `h4`: Heading
- `a`: Link
- `button`: Button
- `p`: Paragraph
- `table`: Table
- `th`: Column Heading
- `td`: Table Cell
- `tr`: Table Row
- `figure`: Chart
- `canvas`: Chart
- `svg`: Chart
- `img`: Image
- `li`: List Item
- `label`: Label
- `span`: Text
- `div`: Area
- `section`: Section
- `header`: Header
- `footer`: Footer
- `nav`: Navigation
- `dialog`: Dialog
- `other`: Element

## `editor`

Where: the inline copy editor that opens over a line of page copy.

- `aria`: Edit This Text
- `input_label`: New Text
- `loading`: Loading the current text
- `braces`: Words in double braces are filled in by the page.
- `unchanged`: Nothing changed.
- `saving`: Saving and rebuilding the page. This takes a few seconds.
- `saved_reload`: Saved as {{id}}. Reloading the page.
- `saved_no_rebuild`: Saved as {{id}}, but the page could not be rebuilt, so it still shows the old words.
- `related_one`: The same words also appear in 1 other place. Checked ones change too.
- `related_many`: The same words also appear in {{n}} other places. Checked ones change too.
- `related_copy`: Copy Entry: {{key}}
- `related_code`: Page Code: {{file}}, Line {{line}}
- `save`: Save
- `cancel`: Cancel
