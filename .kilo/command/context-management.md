# Context Management Commands

## Overview
The context workspace allows project teams to manage various types of contextual information including questions, notes, tasks, and ingested content. Entries can be filtered, searched, and managed through their lifecycle.

## Features

### Entry Types
- **Questions**: User queries or requirements
- **Tasks**: Actionable items or todos
- **Notes**: General information or observations
- **Ingest**: Imported content from external sources

### Status Management
- **Active**: Default state for new entries (visible by default)
- **Completed**: Entries that have been addressed or resolved
- **Archived**: Entries no longer relevant but kept for reference

### Actions Available
- **Edit**: Modify title and body content (authors and admins)
- **Delete**: Remove entries (authors and admins)
- **Pin/Unpin**: Highlight important entries (admins only)
- **Status Changes**: Move between active/completed/archived (admins only)

## Usage

### Filtering
- Use kind filters (All, Questions, Tasks, Notes, Ingest, Treemap)
- Use status filters (Active, Completed, Archived, All Status)
- Combine filters for targeted views

### Pagination
- 20 entries per page for optimal performance
- Navigate using Previous/Next buttons
- Page count shows current position and total entries

### Creating Entries
- Use the composer at the bottom of the workspace
- Select entry type and add content
- AI assistance available for refinement and suggestions

### Managing Entries
- Click edit icon to modify existing entries
- Use status buttons to change lifecycle state
- Pin important entries for visibility (admin only)

## API Endpoints
- `GET /api/projects/[id]/context` - List entries with filtering and pagination
- `POST /api/projects/[id]/context` - Create new entry
- `PUT /api/projects/[id]/context/[entryId]` - Update entry (edit/status)
- `DELETE /api/projects/[id]/context/[entryId]` - Delete entry

## Permissions
- **View**: All project members
- **Create**: All project members
- **Edit/Delete**: Entry author or admin
- **Pin/Status Changes**: Admins only