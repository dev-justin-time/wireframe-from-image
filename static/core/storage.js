export class StorageManager {
    static saveProject(name, data) {
        try {
            const json = JSON.stringify(data);
            localStorage.setItem(`floorplan3d_${name}`, json);
            return true;
        } catch (e) {
            console.error('Failed to save project', e);
            return false;
        }
    }

    static loadProject(name) {
        try {
            const json = localStorage.getItem(`floorplan3d_${name}`);
            return json ? JSON.parse(json) : null;
        } catch (e) {
            console.error('Failed to load project', e);
            return null;
        }
    }
    
    static exportProject(data, filename = 'project.json') {
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
    }

    static async importProject(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const data = JSON.parse(e.target.result);
                    resolve(data);
                } catch (err) {
                    reject(err);
                }
            };
            reader.onerror = reject;
            reader.readAsText(file);
        });
    }

    static getSavedProjects() {
        const projects = [];
        for(let i=0; i<localStorage.length; i++) {
            const key = localStorage.key(i);
            if(key.startsWith('floorplan3d_')) {
                projects.push(key.replace('floorplan3d_', ''));
            }
        }
        return projects;
    }
}