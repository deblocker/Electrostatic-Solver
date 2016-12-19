var Solver = function(ctx, offset) {
	this._slider_w = 3.00;		// [px] slider loop half width (for rendering)
	this._slider_gap = 4.00;	// [px] min gap between sliders (for collisions)
	this._acc_limit = 100.00;	// [px/s^2]
	this._vel_limit = 100.00; 	// [px/s]
	this._friction = 0.90;		// [-]
	this._charge = 250000.00;	// [px^3/s^2]
	this._w = 0;				// max right constraint
	this._h = 0;				// max bottom constraint
	this.sliders = [];			// list of sliders
	this.vel_max = 0.0;			// max abs velocity of sliders for solver precision control
	this.charge = 0.0;			// actual charge of sliders for solve()
	this.mode = 0;				// actual solution precision control mode
	this.time_step = 0.040;		// just time step
	this.sel = -1;				// slider under mouse
	this.ctx = ctx;				// where to draw
	this.offset = offset;		// padding around drawing
};

Solver.Slider = function() {
	// properties
	this.x = 0.0; // actual relative position
	this.y = 0.0; // actual relative position
	this.Z = 0.0; // slider size
	this._horizontal = 0; // orientation
	this.a0 = 0.0; // slider vertexes 0 is anchor point
	this.a1 = 0.0; // slider vertexes 0 is anchor point
	this.b0 = 0.0; // anchor zone for another slider
	this.b1 = 0.0; // anchor zone for another slider
	this.ia = 0; // -1 for fixed or index of parent slider
	this.ib = 0; // -1 or index of parent slider
	this.raw = ''; // used for export
	// computed
	this.ic = []; // list of slider indexes to ignore for perpendicular constraints
	this.a = 0.0; // force field affected part
	this.b = 0.0; // force field affected part
	this.X = 0.0; // actual absolute position
	this.Y = 0.0; // actual absolute position
	this.vx = 0.0; // actual relative velocity
	this.vy = 0.0; // actual relative velocity
	this.ax = 0.0; // actual relative acceleration
	this.ay = 0.0; // actual relative acceleration
	// temp
	this.flag = 0; // temp flag for simulation
	this.x0 = 0.0; // temp variables for solver
	this.x1 = 0.0;  // temp variables for solver
};

Solver.prototype.slider_add = function(ia,ib,x,y,a0,a1,b0,b1,Z,_h){
	var sliders = this.sliders, num = sliders.length;
	var s = new Solver.Slider, q = 0.0;
	if(a0 > a1) { q=a0; a0=a1; a1=q; }
	if(b0 > b1) { q=b0; b0=b1; b1=q; }
	s.x = x; s.vx = 0.0; s.ax = 0.0;
	s.y = y; s.vy = 0.0; s.ay = 0.0;
	s.ia = ia; s.a0 = a0; s.a1 = a1;
	s.ib = -1; s.b0 = b0; s.b1 = b1;
	s.Z = Z; /* Half size */
	if((ib >= 0) && (ib < num)) {
		sliders[ib].ib = num;
	}
	s._horizontal =_h;
	s.a = a0; // min
	if(s.a > a1) s.a = a1;
	if(s.a > b0) s.a = b0;
	if(s.a>b1) s.a = b1;
	s.b = a0; // max
	if(s.b < a1) s.b = a1;
	if(s.b < b0) s.b = b0;
	if(s.b < b1) s.b = b1;
	var l = sliders.push(s);
	return l-1;
};

Solver.prototype.graph = function(w,h,data){
    /*
            ____________________________________________________________   
           |                                                            |   |
           |       _____                    ________________            |   |
           |      /     \                  /                \           |   |
           |=====|       |================|                  |==========|   | 2t
           |      \_____/                  \________________/           |   |
           |a0       0                   b0                 b1        a1|   |
           |____________________________________________________________|   |

    */

	this.sliders.length = 0; this.raw = ''; this._w = w; this._h = h;
	
	this.slider_add(-1,-1, 0, 0, -5, h+5, 0, 0, 0, 0); /* left */
	for(var i=0, l=data.length; i<l; i++) {
		var a = data[i];
		if(a[0]==1) {
			this.slider_add(0,a[2],a[3],a[4],0,w,0,0,0.5*a[5],a[0]);
		}
	}
	this.slider_add(0,-1, 0, h, 0, w, 0, 0, 0, 1); /* bottom */
	for(var i=0, l=data.length; i<l; i++) {
		var a = data[i];
		if(a[0]==0) {
			var a0 = a[8]==0?1-a[7]:a[8]>0?0:a[8];
			var a1 = a[8]==0?a[6]-a[7]+1:a[8]>0?a[8]:0;
			var b0 = a[8];
			var b1 = a[8]==0?0:a[8]>0?a[6]:-a[6];
			this.slider_add(a[1],a[2],a[3],a[4],a0,a1,b0,b1,0.5*a[5],a[0]);
		}
	}
	this.slider_add(-1,-1, w, 0, -5, h+5, 0, 0, 0, 0); /* right */
	this.slider_end();
	
	/* raw data */
	var sliders = this.sliders;
	for(var i=0, l=sliders.length; i<l; i++) {
		var s = sliders[i];
		this.raw += [s.ia,s.ib,s.x,s.y,s.a0,s.a1,s.b0,s.b1,s.Z,s._horizontal].toString()+'\n';
	}
	return this.raw;
};

Solver.prototype.slider_end = function(){
	var sliders = this.sliders;
	var a0 = 0.0, a1 = 0.0, b0 = 0.0, b1 = 0.0, x0 = 0.0, x1 = 0.0, w = this._slider_gap;
	this.positions();
	// detect intersecting sliders and add them to proper ic ignore list
	for(var i=0, l=sliders.length; i<l; i++) {
		var si = sliders[i];
		for(var j=i+1, k=sliders.length; j<k; j++) {
			var sj = sliders[j];
			if(si._horizontal != sj._horizontal) {
				if (si._horizontal == 1) {
					a0=si.X+si.a; a1=sj.X-w;
					b0=si.X+si.b; b1=sj.X+w;
					x0=si.Y; x1=sj.Y;
				} else {
					a0=si.Y+si.a; a1=sj.Y-w;
					b0=si.Y+si.b; b1=sj.Y+w;
					x0=si.X; x1=sj.X;
				}
			if (((a0<=b1)&&(b0>=a1))||((a1<=b0)&&(b1>=a0)))
				if ((x0>x1+sj.a-w)&&(x0<x1+sj.b+w)) {
					si.ic.push(j);
					sj.ic.push(i);
				}
			}
		}
	}
};

Solver.prototype.constraints = function(ix){
	// return true if constraints hit
	var sliders = this.sliders;
	var a0 = 0.0, a1 = 0.0, b0 = 0.0, b1 = 0.0, x0 = 0.0, x1 = 0.0, x = 0.0; 
	var s = sliders[ix], w = this._slider_gap;
	// check parallel neighbours overlap
	for (var i=0, l=sliders.length; i<l; i++) {
		var si = sliders[i];
		if((i != ix) && (si._horizontal == s._horizontal)) {
			if(s._horizontal == 1) {
				a0 = s.X + s.a; a1 = si.X + si.a;
				b0 = s.X + s.b; b1 = si.X + si.b;
				x0 = s.Y; x1 = si.Y;
			} else {
				a0 = s.Y + s.a; a1 = si.Y + si.a;
				b0 = s.Y + s.b; b1 = si.Y + si.b;
				x0 = s.X; x1 = si.X;
			}
			if(((a0 <= b1) && (b0 >= a1)) || ((a1 <= b0) && (b1 >= a0))) {
				if ((i < ix) && (x0 < x1 + w)) return true;
				if ((i > ix) && (x0 > x1 - w)) return true;
			}
		}
	}
	// check perpendicular neighbours overlap
	for (var i=0, l=sliders.length; i<l; i++) {
		var si = sliders[i];
		if((i != ix) && (si._horizontal != s._horizontal)) {
			// skip ignored sliders for this
			var ignore = false;
			for(var n=0, m=s.ic.length; n<m; n++) {
				if(s.ic[n] == i) {
					ignore = true;
					break;
				}
			}
			if(ignore === true) continue;
			if(s._horizontal == 1) {
				a0 = s.X + s.a; a1 = si.X - w;
				b0 = s.X + s.b; b1 = si.X + w;
				x0 = s.Y; x1 = si.Y;
			} else {
				a0 = s.Y + s.a; a1 = si.Y - w; 
				b0 = s.Y + s.b;  b1 = si.Y + w; 
				x0 = s.X; x1 = si.X;
			}
			if (((a0 <= b1) && (b0 >= a1)) || ((a1 <= b0) && (b1 >= a0)))
				if ((x0 > x1 + si.a - w) && (x0 < x1 + si.b + w))
					return true;
		}
	}
	// conflict a anchor area of parent?
	if(s.ia >= 0) {
		var si = sliders[s.ia];
		if (s._horizontal == 1) {
			x0 = si.Y + si.a0; x1 = si.Y + si.a1; x = s.Y;
		} else {
			x0 = si.X + si.a0; x1 = si.X + si.a1; x = s.X;
		}
		if(x < x0 + w) return true;
		if(x > x1 - w) return true;
	}
	// conflict b anchor area of parent?
	if (s.ib >= 0) {
		var si = sliders[s.ib];
		if(si._horizontal == 1) {
			x0 = si.X + si.b0; x1 = si.X + si.b1; x = s.X;
		} else {
			x0 = si.Y + si.b0; x1 = si.Y + si.b1; x = s.Y;
		}
		if(x < x0 + w) return true;
		if(x > x1 - w) return true;
	}
	// conflict b anchor area with childs?
	for (var i=0, l=sliders.length; i<l; i++) {
		var si = sliders[i];
		if ((i != ix) && (si.ib == ix)) {
			if (s._horizontal == 1) {
				x0 = s.X + s.b0; x1 = s.X + s.b1; x = si.X;
			} else {
				x0 = s.Y + s.b0; x1 = s.Y + s.b1; x = si.Y;
			}
			if(x < x0 + w) return true;
			if(x > x1 - w) return true;
		}
	}
	// check childs too
	for (var i=0, l=sliders.length; i<l; i++) {
		var si = sliders[i];
		if((i != ix) && (si.ia == ix))
			if(this.constraints(i)) return true;
	}
	return false;
};

Solver.prototype.positions = function(ix){
	// recompute absolute positions
	var sliders = this.sliders;
	// set flag = uncomputed
	for(var i=0, l=sliders.length; i<l; i++) {
		sliders[i].flag = 0;
	}
	// iterate until all sliders are computed
	var e = true;
	while(e) {
		e = false;
		for(var i=0, l=sliders.length; i<l; i++) {
			var si = sliders[i];
			if(si.flag == 0) {
				// fixed
				if (si.ia < 0) {
					si.X = si.x;
					si.Y = si.y;
					si.flag = 1;
					continue;
				}
				// a anchored
				var sa = sliders[si.ia];
				if(sa.flag == 1) {
					si.X=sa.X+si.x;
					si.Y=sa.Y+si.y;
					si.flag = 1;
					continue;
				}
				e = true; // not finished yet
			}
		}
	}
};

Solver.prototype.update = function(){
	 // update physics simulation with time step dt [sec]
	var sliders = this.sliders, dt = this.time_step;
	var x = 0.0, X = 0.0;
	
	// D'Lamnbert integration
	for(var i=0, l=sliders.length; i<l; i++) {
		var si = sliders[i];
		if(si._horizontal == 1) {
			x = si.y; si.vy += si.ay*dt;     // vel = Integral(acc*dt)
			si.vy *= this._friction;     // friction k*vel
			X = si.Y; si.y += si.vy*dt;     // pos = Integral(vel*dt)
			this.positions();                    // recompute childs
			if ((si.ia < 0) || (this.constraints(i))) {
				// if fixed or constraint hit (stop and restore original position)
				si.vy = 0.0;
				si.y = x;
				si.Y = X;
				this.positions();                // recompute childs
			}
		} else {
			x = si.x; si.vx += si.ax*dt;     // vel = Integral(acc*dt)
			si.vx *= this._friction;     // friction k*vel
			X = si.X; si.x += si.vx*dt;     // pos = Integral(vel*dt)
			this.positions();                    // recompute childs
			if((si.ia < 0) || (this.constraints(i))) {
				// if fixed or constraint hit (stop and restore original position)
				si.vx = 0.0;
				si.x = x;
				si.X = X;
				this.positions();                // recompute childs
			}
		}
	}
};

Solver.prototype.solve = function(_init){
	var sliders = this.sliders, fabs = Math.abs;
	 // set sliders accelerations to solve this
	var a0 = 0.0, a1 = 0.0, b0 = 0.0, b1 = 0.0, x0 = 0.0, x1 = 0.0;
	// init solution
	if(_init) {
		this.mode = 0;
		this.charge = this._charge;
	}
	// clear accelerations and compute actual max velocity
	this.vel_max = 0.0;
	for(var i=0, l=sliders.length; i<l; i++) {
		var si = sliders[i];
		si.ax = 0.0;
		si.ay = 0.0;
		x0 = fabs(si.vx); if(this.vel_max < x0) this.vel_max = x0;
		x0 = fabs(si.vy); if(this.vel_max < x0) this.vel_max = x0;
	}
	// precision control of solver
	if ((this.mode == 0) && (this.vel_max > 25.0)) {
		// wait until speed raises
		this.mode++;
	}
	if ((this.mode == 1) && (this.vel_max < 10.0)) {
		// scale down forces to lower jitter
		this.mode++; this.charge *= 0.10;
	}
	if ((this.mode == 2) && (this.vel_max < 1.0)) {
		// scale down forces to lower jitter
		this.mode++; this.charge *= 0.10;
	}
	if ((this.mode == 3) && (this.vel_max < 0.1)) {
		// solution found
		this.mode++; this.charge = 0.00; 
		this.stop();
	}
	// set x0 as 1D vector to closest parallel neighbour before and x1 after
	for(var i=0, l=sliders.length; i<l; i++) {
		var si = sliders[i];
		si.x0 = 0.0; si.x1 = 0.0;
	}
	for(var i=0, l=sliders.length; i<l; i++) {
		var si = sliders[i];
		for(var j=i+1, k=sliders.length; j<k; j++) {
			var sj = sliders[j];
			if(si._horizontal == sj._horizontal) {
				// longer side interaction
				if(si._horizontal == 1) {
					a0 = si.X + si.a; a1 = sj.X + sj.a;
					b0 = si.X + si.b; b1 = sj.X + sj.b;
					x0 = si.Y; x1 = sj.Y;
				} else {
					a0 = si.Y + si.a; a1 = sj.Y + sj.a;
					b0 = si.Y + si.b; b1 = sj.Y + sj.b;
					x0 = si.X; x1 = sj.X;
				}
				if(((a0 <= b1) && (b0 >= a1)) || ((a1 <= b0) && (b1 >= a0))) {
					x0 = x1 - x0;
					if((si.ia >= 0) && (x0 < 0.0) && ((fabs(si.x0) < this._slider_gap) || (fabs(si.x0) > fabs(x0)))) si.x0 = -x0;
					if((si.ia >= 0) && (x0 > 0.0) && ((fabs(si.x1) < this._slider_gap) || (fabs(si.x1) > fabs(x0)))) si.x1 = -x0;
					if((sj.ia >= 0) && (x0 < 0.0) && ((fabs(sj.x0) < this._slider_gap) || (fabs(sj.x0) > fabs(x0)))) sj.x0 = +x0;
					if((sj.ia >= 0) && (x0 > 0.0) && ((fabs(sj.x1) < this._slider_gap) || (fabs(sj.x1) > fabs(x0)))) sj.x1 = +x0;
					//if((si.ia >= 0) && (x0 < 0.0) && ((fabs(si.x0) < si.Z) || (fabs(si.x0) > fabs(x0)))) si.x0 = -x0;
					//if((si.ia >= 0) && (x0 > 0.0) && ((fabs(si.x1) < si.Z) || (fabs(si.x1) > fabs(x0)))) si.x1 = -x0;
					//if((sj.ia >= 0) && (x0 < 0.0) && ((fabs(sj.x0) < sj.Z) || (fabs(sj.x0) > fabs(x0)))) sj.x0 = +x0;
					//if((sj.ia >= 0) && (x0 > 0.0) && ((fabs(sj.x1) < sj.Z) || (fabs(sj.x1) > fabs(x0)))) sj.x1 = +x0;
				}
				// shorter side interaction
				if(si._horizontal == 1) {
					a0 = si.Y - this._slider_gap; a1 = sj.Y + this._slider_gap;
					b0 = si.Y + this._slider_gap; b1 = sj.Y + this._slider_gap;
					//a0 = si.Y - si.Z; a1 = sj.Y + sj.Z;
					//b0 = si.Y + si.Z; b1 = sj.Y + sj.Z;
					x0 = si.X; x1 = sj.X;
				} else {
					a0 = si.X - this._slider_gap; a1 = sj.X + this._slider_gap;
					b0 = si.X + this._slider_gap; b1 = sj.X + this._slider_gap;
					//a0 = si.X - si.Z; a1 = sj.X + sj.Z;
					//b0 = si.X + si.Z; b1 = sj.X + sj.Z;
					x0 = si.Y; x1 = sj.Y;
				}
				if(((a0 <= b1) && (b0 >= a1)) || ((a1 <= b0) && (b1 >= a0))) {
					if(x0 < x1) {
						x0 += si.b; x1 += sj.a;
					} else{
						x0 += si.a; x1 += sj.b;
					}
					x0 = x1 - x0;
					if(si.ia >= 0) {
						var sa = this.sliders[si.ia];
						if((sa.ia >= 0) && (x0 < 0.0) && ((fabs(sa.x0) < this._slider_gap) || (fabs(sa.x0) > fabs(x0)))) sa.x0 = -x0;
						if((sa.ia >= 0) && (x0 > 0.0) && ((fabs(sa.x1) < this._slider_gap) || (fabs(sa.x1) > fabs(x0)))) sa.x1 = -x0;
						//if((sa.ia >= 0) && (x0 < 0.0) && ((fabs(sa.x0) < sa.Z) || (fabs(sa.x0) > fabs(x0)))) sa.x0 = -x0;
						//if((sa.ia >= 0) && (x0 > 0.0) && ((fabs(sa.x1) < sa.Z) || (fabs(sa.x1) > fabs(x0)))) sa.x1 = -x0;
					}
					if(sj.ia >= 0) {
						var sa = sliders[sj.ia];
						if((sa.ia >= 0) && (x0 < 0.0) && ((fabs(sa.x0) < this._slider_gap) || (fabs(sa.x0) > fabs(x0)))) sa.x0 = +x0;
						if((sa.ia >= 0) && (x0 > 0.0) && ((fabs(sa.x1) < this._slider_gap) || (fabs(sa.x1) > fabs(x0)))) sa.x1 = +x0;
						//if((sa.ia >= 0) && (x0 < 0.0) && ((fabs(sa.x0) < sa.Z) || (fabs(sa.x0) > fabs(x0)))) sa.x0 = +x0;
						//if((sa.ia >= 0) && (x0 > 0.0) && ((fabs(sa.x1) < sa.Z) || (fabs(sa.x1) > fabs(x0)))) sa.x1 = +x0;
					}
				}
			}
		}
	}
	// set x0 as 1D vector to closest perpendicular neighbour before and x1 after
	for(var i=0, l=sliders.length; i<l; i++) {
		var si = sliders[i];
		for(var j=i+1, k=sliders.length; j<k; j++) {
			var sj = sliders[j];
			if(si._horizontal != sj._horizontal) {
				// skip ignored sliders for this
				var ignore = false;
				for(var n=0, m=si.ic.length; n<m; n++) {
					if(si.ic[n] == j) {
						ignore = true;
						break;
					}
				}
				if(ignore === true) continue;
				if(si._horizontal == 1) {
					a0 = si.X + si.a; a1 = sj.X - this._slider_w;
					b0 = si.X + si.b; b1 = sj.X + this._slider_w;
					//a0 = si.X + si.a; a1 = sj.X - sj.Z;
					//b0 = si.X + si.b; b1 = sj.X + sj.Z;
					x0 = si.Y;
				} else {
					a0 = si.Y + si.a; a1 = sj.Y - this._slider_w;
					b0 = si.Y + si.b; b1 = sj.Y + this._slider_w;
					//a0 = si.Y + si.a; a1 = sj.Y - sj.Z;
					//b0 = si.Y + si.b; b1 = sj.Y + sj.Z;
					x0 = si.X;
				}
				if(((a0 <= b1) && (b0 >= a1)) || ((a1 <= b0) && (b1 >= a0))){
					if(si._horizontal == 1) {
						a1 = sj.Y + sj.a;
						b1 = sj.Y + sj.b;
							} else {
						a1 = sj.X + sj.a;
						b1 = sj.X + sj.b;
					}
					a1 -= x0; b1 -= x0;
					if(fabs(a1) < fabs(b1)) x0 = -a1; else x0 = -b1;
					if((si.ia >= 0) && (x0 < 0.0) && ((fabs(si.x0) < this._slider_gap) || (fabs(si.x0) > fabs(x0)))) si.x0 = +x0;
					if((si.ia >= 0) && (x0 > 0.0) && ((fabs(si.x1) < this._slider_gap) || (fabs(si.x1) > fabs(x0)))) si.x1 = +x0;
					//if((si.ia >= 0) && (x0 < 0.0) && ((fabs(si.x0) < si.Z) || (fabs(si.x0) > fabs(x0)))) si.x0 = +x0;
					//if((si.ia >= 0) && (x0 > 0.0) && ((fabs(si.x1) < si.Z) || (fabs(si.x1) > fabs(x0)))) si.x1 = +x0;
					if(sj.ia < 0) continue;
					var sa = sliders[sj.ia];
					if((sa.ia >= 0) && (x0 < 0.0) && ((fabs(sa.x0) < this._slider_gap) || (fabs(sa.x0) > fabs(x0)))) sa.x0 = -x0;
					if((sa.ia >= 0) && (x0 > 0.0) && ((fabs(sa.x1) < this._slider_gap) || (fabs(sa.x1) > fabs(x0)))) sa.x1 = -x0;
					//if((sa.ia >= 0) && (x0 < 0.0) && ((fabs(sa.x0) < sa.Z) || (fabs(sa.x0) > fabs(x0)))) sa.x0 = -x0;
					//if((sa.ia >= 0) && (x0 > 0.0) && ((fabs(sa.x1) < sa.Z) || (fabs(sa.x1) > fabs(x0)))) sa.x1 = -x0;
				}
			}
		}
	}
	// convert x0,x1 distances to acceleration
	for (var i=0, l=sliders.length; i<l; i++) {
		var si = sliders[i];
		// driving force F = ~ Q / r^2
		if(fabs(si.x0) > 1e-10) { x0 = this.charge/(si.x0*si.x0) } else x0 = 0.0;
		if(si.x0 < 0.0) x0 = -x0;
		if(fabs(si.x1) > 1e-10) { x1 = this.charge/(si.x1*si.x1) } else x1 = 0.0;
		if(si.x1 < 0.0) x1 = -x1;
		a0 = x0 + x1;
		// limit acc
		if(a0 < -this._acc_limit) a0 = -this._acc_limit;
		if(a0 > +this._acc_limit) a0 = +this._acc_limit;
		// store parallel acc to correct axis
		if(si._horizontal == 1) { si.ay = a0 } else si.ax = a0;
		// limit vel (+/- one iteration overlap)
		if(si._horizontal == 1) { x0 = si.vy } else x0 = si.vx;
		if(x0 < - this._vel_limit) x0 = -this._vel_limit;
		if(x0 > + this._vel_limit) x0 = +this._vel_limit;
		if(si._horizontal == 1) { si.vy = x0 } else si.vx = x0;
	}
};

Solver.prototype.stop = function() {
	var sliders = this.sliders;
	for(var i=0, l=sliders.length; i<l; i++) {
		var si = sliders[i];
		si.vx = 0.0;
		si.vy = 0.0;
		si.ax = 0.0;
		si.ay = 0.0;
	}
};

Solver.prototype.mouse = function(x,y) {
	var sliders = this.sliders, fabs = Math.abs;
	var x1 = 0, y1 = 0, x2 = 0, y2 = 0, sel = -1;
	var w = this._slider_w;
	for(var i=0, l=sliders.length; i<l; i++) {
		var s = sliders[i];
		if(s._horizontal) {
			x1 = s.X + s.a; x2 = s.X + s.b;
			y1 = s.Y - w; y2 = s.Y + w;
		} else {
			x1 = s.X - w; x2 = s.X + w;
			y1 = s.Y + s.a; y2 = s.Y + s.b;
		}
		if((x > x1) && (x < x2) && (y > y1) && (y < y2)) sel = i;
	}
	this.sel = sel;
};
		
Solver.prototype.draw = function() {
	var sliders = this.sliders, sel = this.sel, fabs = Math.abs;
	var ctx = this.ctx, offset = this.offset, cW = this._w+2*offset, cH = this._h+2*offset;
	var lw = this._slider_w,r,x,y,a0,a1;

	function _line(horz, aa, bb) {
		ctx.beginPath();
		if(horz) {
			ctx.moveTo(s.X + aa, s.Y);
			ctx.lineTo(s.X + bb, s.Y);
		} else {
			ctx.moveTo(s.X, s.Y + aa);
			ctx.lineTo(s.X, s.Y + bb);
		}
		ctx.stroke();
		ctx.closePath();
	}

	function _roundRect(x, y, w, h, r) {
		ctx.beginPath();
		ctx.moveTo(x + r, y);
		ctx.lineTo(x + w - r, y);
		ctx.quadraticCurveTo(x + w, y, x + w, y + r);
		ctx.lineTo(x + w, y + h - r);
		ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
		ctx.lineTo(x + r, y + h);
		ctx.quadraticCurveTo(x, y + h, x, y + h - r);
		ctx.lineTo(x, y + r);
		ctx.quadraticCurveTo(x, y, x + r, y);
		ctx.stroke();
		ctx.closePath();
	}

	ctx.fillStyle = "black";
	ctx.fillRect(0,0,cW,cH);
	ctx.translate(offset, offset);
	ctx.font = '14px Courier New';
	ctx.fillStyle = "white";
	ctx.fillText("mode "+this.mode, 40, 60);
	ctx.fillText("vel: "+this.vel_max.toFixed(3)+" [px/s]", 40, 80);
	ctx.fillText("  Q: "+this.charge.toFixed(3)+" [px^3/s^2]", 40, 100);
	ctx.strokeStyle = "silver";
	ctx.lineWidth = 1;
	for(var i=0, l=sliders.length; i<l; i++) {
		var s = sliders[i];
		if(i == sel) {
			ctx.fillStyle = "yellow";
			var txt = " ix:"+sel+" ia:"+s.ia+" ib:"+s.ib+" ic:"
			for(var j=0, k=s.ic.length; j<k ; j++) {
				txt += " "+s.ic[j];
			}
			ctx.fillText(txt, 40, 120);
			ctx.fillText("pos: "+s.X.toFixed(3)+" "+s.Y.toFixed(3)+" [px]", 40, 140);
			ctx.fillText("vel: "+s.vx.toFixed(3)+" "+s.vy.toFixed(3)+" [px/s]", 40, 160);
			ctx.fillText("acc: "+s.ax.toFixed(3)+" "+s.ay.toFixed(3)+" [px/s^2]", 40, 180);
		}
		if(s.ia < 0)
			ctx.setLineDash([16, 10]);
		else {
			ctx.setLineDash([]);
			/* Size */
			if(s.Z > 0) {
				ctx.strokeStyle = "firebrick"
				if(s._horizontal == 1) {
					x = s.X;
					y = s.Y;
					var _h = 2*s.Z, _w = fabs(s.b - s.a);
					_roundRect(x, y - 0.5*_h, _w, _h, 1);
				} else {
					x = s.X;
					y = s.Y + s.a;
					var _h = fabs(s.b - s.a), _w = 2*s.Z;
					_roundRect(x - 0.5*_w, y, _w, _h, 1);
				}
			}
		}
		if(i == sel) {
			ctx.strokeStyle = "yellow";
		} else {
			if(s._horizontal == 1)
				ctx.strokeStyle = "silver"
			else
				ctx.strokeStyle = "aqua";
		}
		// a anchor loop
		x = s.X;
		y = s.Y;
		if(s.ia >= 0) {
			ctx.beginPath();
			ctx.arc(x, y, lw, 0, 2*Math.PI);
			ctx.stroke();
			ctx.closePath();
		}
		// b anchor loop
		r = 0.5*fabs(s.b1 - s.b0);
		if(s._horizontal == 1) {
			x = s.X + 0.5*(s.b0 + s.b1);
			y = s.Y;
			_roundRect(x - r, y - lw, 2*r, 2*lw, lw);
		} else {
			x = s.X;
			y = s.Y + 0.5*(s.b0 + s.b1);
			_roundRect(x - lw, y - r, 2*lw, 2*r, lw);
		}
		// a line cutted by a anchor loop
		a0 = s.a0; a1 = s.a1;
		if((s.ia >= 0) && (a0 <= +lw) && (a1 >= -lw)){
			if(a0 < -lw) _line(s._horizontal, s.a0, -lw);
			if(a1 > +lw) _line(s._horizontal, +lw, s.a1);
		} else _line(s._horizontal, s.a0, s.a1);
	}
	ctx.translate(-offset, -offset);
};

