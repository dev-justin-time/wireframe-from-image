export const MOCK_DATA = {
    bathroom: {
        walls: [
            {start:{x:100,y:100}, end:{x:500,y:100}, thickness:10},
            {start:{x:500,y:100}, end:{x:500,y:400}, thickness:10},
            {start:{x:500,y:400}, end:{x:100,y:400}, thickness:10},
            {start:{x:100,y:400}, end:{x:100,y:100}, thickness:10}
        ],
        fixtures: [
            {type:'bathtub', x:150, y:150, rotation:0},
            {type:'toilet', x:450, y:150, rotation:Math.PI},
            {type:'sink', x:300, y:120, rotation:0}
        ],
        fixtureStyles: {}
    },
    bedroom: {
        walls: [
            {start:{x:0,y:0}, end:{x:400,y:0}, thickness:10},
            {start:{x:400,y:0}, end:{x:400,y:500}, thickness:10},
            {start:{x:400,y:500}, end:{x:0,y:500}, thickness:10},
            {start:{x:0,y:500}, end:{x:0,y:0}, thickness:10}
        ],
        fixtures: [
            {type:'bed_queen', x:200, y:100, rotation:0},
            {type:'nightstand', x:120, y:50, rotation:0},
            {type:'nightstand', x:280, y:50, rotation:0},
            {type:'wardrobe', x:50, y:250, rotation:Math.PI/2}
        ],
        fixtureStyles: {}
    },
    simple_room: {
        id: "test_plan_01",
        version: "1.0",
        rooms: [
            {
                id: "room_1",
                name: "Master Bedroom",
                type: "bedroom",
                walls: [
                    { start: { x: 0, y: 0 }, end: { x: 5, y: 0 } },
                    { start: { x: 5, y: 0 }, end: { x: 5, y: 4 } },
                    { start: { x: 5, y: 4 }, end: { x: 0, y: 4 } },
                    { start: { x: 0, y: 4 }, end: { x: 0, y: 0 } }
                ]
            }
        ]
    }
};