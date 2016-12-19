var cases = [];
cases.push(
	{w: 400, h:400, data: [
		[1, 0, -1,0,  0, 20],
		[1, 0, -1,0,100, 20],
		[1, 0, -1,0,200, 20],
		[1, 0, -1,0,300, 20],
		[0, 1,  3, 20,0, 20,250,  1, 125],
		[0, 4, -1, 40,0, 20,100, 71,   0],
		[0, 2, -1, 60,0, 80,100, 71,   0],
		[0, 3, -1, 80,0,200,100, 31,   0],
		[0, 4,  2,100,0, 20,250,249,-125]
		]
	}
);
cases.push(
	{w: 400, h:300, data: [
		[1, 0, -1,0,  0, 20],
		[1, 0, -1,0,100, 20],
		[1, 0, -1,0,200, 20],
		[1, 0, -1,0,220, 20],
		[0, 1,  3, 20,0, 20,250,  1, 125],
		[0, 4, -1, 40,0, 20,100, 71,   0],
		[0, 2, -1, 60,0, 80,100, 71,   0],
		[0, 3, -1, 80,0,200,100, 31,   0],
		[0, 4,  2,100,0, 20,250,249,-125]
		]
	}
);


function case_load(i) {
	clearInterval(m_loop);
	if(solver) solver.stop();
	solver = null;

	var w = cases[i].w, h = cases[i].h, data = cases[i].data, padding = 25;
	var cv = document.getElementById("drawing");
	cv.width = w + 2*padding;
	cv.height = h + 2*padding;

	solver = new Solver(cv.getContext("2d"), padding);

	var ss = solver.graph(w, h, data);
	document.getElementById("sliders").value = ss;
	
	solver.solve(true);
	if(s_speed == 0) {
		m_loop = window.setInterval(animate, 1000 / 30);
		animate();
	} else {
		solve();
	}	
}

function animate() {
	// stop if solution found or stuck
	if(!solver) return;
	if(solver.mode < 4) {
		solver.solve();
		solver.update();
	}
	solver.draw();
}

function solve() {
	if(!solver) return;
	var l = 0;
	while(solver.mode < 4) {
		l++;
		solver.solve();
		solver.update();
		if(l > 10000) break;
	}
	console.log("solved by "+l+" iterations");
	solver.draw();
}

