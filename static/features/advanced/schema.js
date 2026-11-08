/**
 * Advanced feature 28 - project schema versioning + migration.
 *
 * Saved projects carry a `version`. Loading an older file runs the migration
 * steps up to the current version and reports what changed, so the editor never
 * has to guess whether a missing field means "old file" or "empty value". A file
 * from a newer app version is refused rather than silently half-loaded.
 */

export const PROJECT_SCHEMA_VERSION = 2;

/** Fields introduced with version 2 that older saves may not have. */
export function migrateProject(data) {
    if (!data || typeof data !== 'object') {
        return { project: null, from: null, migrated: false, error: 'empty project' };
    }

    const from = Number.isInteger(data.version) ? data.version : 1;
    if (from > PROJECT_SCHEMA_VERSION) {
        return {
            project: null,
            from,
            migrated: false,
            error: `project version ${from} is newer than this editor (${PROJECT_SCHEMA_VERSION})`
        };
    }

    const project = { ...data };
    const changes = [];

    if (!Array.isArray(project.walls)) {
        project.walls = [];
        changes.push('walls');
    }
    if (!Array.isArray(project.fixtures)) {
        project.fixtures = [];
        changes.push('fixtures');
    }
    if (!project.fixtureStyles || typeof project.fixtureStyles !== 'object') {
        project.fixtureStyles = {};
        changes.push('fixtureStyles');
    }
    if (!Number.isFinite(project.gridSize)) {
        project.gridSize = 30;
        changes.push('gridSize');
    }
    if (typeof project.showCeiling !== 'boolean') {
        project.showCeiling = false;
        changes.push('showCeiling');
    }
    if (typeof project.showRoof !== 'boolean') {
        project.showRoof = false;
        changes.push('showRoof');
    }

    // Version 2 items: filled per item by ItemFactory.fromJSON, but the version
    // is what tells a future migration that these fields were expected.
    project.version = PROJECT_SCHEMA_VERSION;

    return {
        project,
        from,
        migrated: from !== PROJECT_SCHEMA_VERSION,
        changes,
        error: null
    };
}

/** Attach the current schema version to a project about to be saved. */
export function stampProject(data = {}) {
    return { ...data, version: PROJECT_SCHEMA_VERSION };
}
