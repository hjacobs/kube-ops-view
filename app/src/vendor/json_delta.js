/* JSON-delta v2.0 - A diff/patch pair for JSON-serialized data
structures.

Copyright 2013-2015 Philip J. Roberts <himself@phil-roberts.name>.
All rights reserved

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are
met:

1. Redistributions of source code must retain the above copyright
notice, this list of conditions and the following disclaimer.

2. Redistributions in binary form must reproduce the above copyright
notice, this list of conditions and the following disclaimer in the
documentation and/or other materials provided with the distribution.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS
"AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT
LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR
A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT
HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL,
SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT
LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE,
DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY
THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
(INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.

This implementation is based heavily on the original python2 version:
see http://www.phil-roberts.name/json-delta/ for further
documentation.  */

export const JSON_delta = {
    // Main entry points: ======================================================
    patch: function(struc, diff) {
        /* Apply the sequence of diff stanzas diff to the structure
         struc, and returns the patched structure. */
	var stan_key;
        for (stan_key = 0; stan_key < diff.length; stan_key++) {
            struc = this.patchStanza(struc, diff[stan_key]);
        }
        return struc;
    },

    diff: function(left, right, minimal, key) {
	/* Build a diff between the structures left and right.

	 Parameters:
	     key: this is used for mutual recursion between this
	         function and those it calls.  Normally it should be
	         left unset or set as its default [].

	     minimal: if this flag is set true, the function will try
                 harder to find the diff that encodes as the shortest
                 possible JSON string, at the expense of using more of
                 both memory and processor time (as alternatives are
                 computed and compared).
	*/
        key = key !== undefined ? key : [];
        minimal = minimal !== undefined ? minimal : true;
        var dumbdiff = [[key, right]], my_diff = [], common;

	if (this.structureWorthInvestigating(left, right)) {
	    common = this.commonality(left, right);
            if (minimal) {
		my_diff = this.needleDiff(left, right, minimal, key);
            } else if (common < 0.5) {
		my_diff = this.thisLevelDiff(left, right, key, common);
            } else {
		my_diff = this.keysetDiff(left, right, minimal, key);
            }
	} else {
	    my_diff = this.thisLevelDiff(left, right, key, 0.0);
	}

        if (minimal) {
            if (JSON.stringify(dumbdiff).length <
                JSON.stringify(my_diff).length) {
                my_diff = dumbdiff;
            }
        }

        if (key.length === 0) {
            if (my_diff.length > 1) {
                my_diff = this.sortStanzas(my_diff);
            }
        }
        return my_diff;
    },

    // =========================================================================

    isStrictlyEqual: function(left, right) {
	/* Recursively compare the (potentially nested) objects left
	 * and right */
	var idx, ks, key;
        if (this.isTerminal(left) && this.isTerminal(right)) {
            return (left === right);
        }
        if (this.isTerminal(left) || this.isTerminal(right)) {
            return false;
        }
        if (left instanceof Array && right instanceof Array) {
            if (left.length !== right.length) {
                return false;
            }
            for (idx = 0; idx < left.length; idx++) {
                if (! this.isStrictlyEqual(left[idx], right[idx])) {
                    return false;
                }
            }
            return true;
        }
        if (left instanceof Array || right instanceof Array) {
            return false;
        }
        ks = this.computeKeysets(left, right);
        if (ks[1].length !== 0 || ks[2].length !== 0) {
            return false;
        }
        for (idx = 0; idx < ks[0].length; idx++) {
            key = ks[0][idx];
            if (! this.isStrictlyEqual(left[key], right[key])) {
                return false;
            }
        }
        return true;
    },

    isTerminal: function(obj) {
	/* Test whether obj will be a terminal node in the tree when
	 * serialized as JSON. */
        if (typeof obj === 'string' || typeof obj === 'number' ||
	    typeof obj === 'boolean' || obj === null) {
            return true;
        }
        return false;
    },

    appendKey: function(stanzas, arr, key) {
	/* Get the appropriate key for appending to the array arr,
	 * assuming that stanzas will also be applied, and arr appears
	 * at key within the overall structure. */
	key = key !== undefined ? key : [];
	var addition_key = arr.length, prior_key, i;
	for (i = 0; i < stanzas.length; i++) {
	    prior_key = stanzas[i][0];
	    if (stanzas[i].length > 1 &&
		prior_key.length === key.length + 1 &&
		prior_key[prior_key.length-1] >= addition_key)
	    { addition_key = prior_key[prior_key.length-1] + 1; }
	}
	return addition_key;
    },

    loopOver: function(obj, callback) {
	/* Helper function for looping over obj.  Does the Right Thing
	 * whether obj is an array or not. */
	var i, key;
	if (obj instanceof Array) {
	    for (i = 0; i < obj.length; i++) {
		callback(obj, i);
	    }
	} else {
	    for (key in obj) {
		if (obj.hasOwnProperty(key)) {
		    callback(obj, key);
		}
	    }
	}
    },

    inArray: function(keypath) {
	var terminal = keypath[keypath.length - 1];
	return (typeof terminal === 'number')
    },

    inObject: function(keypath) {
	var terminal = keypath[keypath.length - 1];
	return (typeof terminal === 'string')
    },

    splitDiff: function(diff) {
	/* Split the stanzas in diff into an array of three arrays:
	 * [modifications, deletions, insertions]. */
	var idx, objs = [], mods = [], dels = [], inss = [];
	var dests = {3: inss, 1: dels}, stanza, keypath;
        if (diff.length === 0) {return [[], diff];}
        for (idx = 0; idx < diff.length; idx++) {
	    stanza = diff[idx]
	    if (stanza.length === 2) {
		if (this.inObject(stanza[0])) {
		    objs.push(stanza);
		} else {
		    mods.push(stanza);
		}
	    } else {
		dests[stanza.length].push(stanza)
	    }
        }
        return [objs, mods, dels, inss];
    },

    stableKeypathLengthSort: function(stanzas) {
	var comparator = function (a, b) {
	    var swap;
	    if (a[0].length === b[0].length) {
		return a[0][0] - b[0][0];
	    }
	    return b[0].length - a[0].length;
	}
	for (var i = 0; i < stanzas.length; i++) {
	    stanzas[i][0].unshift(i)
	}
	stanzas.sort(comparator)
	for (i = 0; i < stanzas.length; i++) {
	    stanzas[i][0].shift()
	}
	return stanzas
    },

    keypathCompare: function(a, b) {
	a = a[0]; b = b[0];
	if (a.length !== b.length) {
	    return a.length - b.length;
	}
	for (var i = 0; i < a.length; i++) {
	    if (typeof a[i] === 'number' && a[i] !== b[i]) {
		return a[i] - b[i];
	    }
	}
	return 0;
    },

    keypathCompareReverse: function(a, b) {
	a = a[0]; b = b[0];
	if (a.length !== b.length) {
	    return b.length - a.length;
	}
	for (var i = 0; i < a.length; i++) {
	    if (typeof a[i] === 'number' && a[i] !== b[i]) {
		return b[i] - a[i];
	    }
	}
	return 0;
    },

    sortStanzas: function(diff) {
        /* Sorts the stanzas in a diff: object changes can occur in
	 * any order, but deletions from arrays have to happen last
	 * node first: ['foo', 'bar', 'baz'] -> ['foo', 'bar'] ->
	 * ['foo'] -> []; additions to sequences have to happen
	 * leftmost-node-first: [] -> ['foo'] -> ['foo', 'bar'] ->
	 * ['foo', 'bar', 'baz'], and insert-and-shift alterations to
	 * arrays must happen last. */

        // First we divide the stanzas using splitDiff():
        var split_thing = this.splitDiff(diff);
	// Then we sort modifications of arrays in ascending order of keypath
	// (note that we can?t tell appends from mods on the info available):
        split_thing[1].sort(this.keypathCompare);
        // Deletions from arrays in descending order of keypath:
        split_thing[2].sort(this.keypathCompareReverse);
	// And insert-and-shifts in ascending order of keypath:
        split_thing[3].sort(this.keypathCompare)
        diff = split_thing[0].concat(
	    split_thing[1], split_thing[2], split_thing[3]
	);
	// Finally, we sort by length of keypath:
	diff = this.stableKeypathLengthSort(diff, true)
	return diff
    },

    computeKeysets: function(left, right) {
        /* Returns an array of three arrays (overlap, left_only,
         * right_only), representing the properties common to left and
         * right, only defined for left, and only defined for right,
         * respectively. */
        var overlap = [], left_only = [], right_only = [];
        var target = overlap;

        this.loopOver(left, function(obj, key) {
            if (right[key] !== undefined) {
                target = overlap;
            }
            else {
                target = left_only;
            }
            target.push(key);
        });
        this.loopOver(right, function(obj, key) {
            if (left[key] === undefined) {
                right_only.push(key);
            }
        });
        return [overlap, left_only, right_only];
    },

    structureWorthInvestigating: function(left, right) {
	/* Test whether it is worth looking at the internal structure
	 * of `left` and `right` to see if they can be efficiently
	 * diffed. */
        if (this.isTerminal(left) || this.isTerminal(right)) {
            return false;
        }
	if ((left.length === 0) || (right.length === 0)) {
	    return false;
	}
        if ((left instanceof Array) && (right instanceof Array)) {
	    return true;
	}
	if ((left instanceof Array) || (right instanceof Array)) {
	    return false;
	}
	if ((typeof left === 'object') && (typeof right === 'object')) {
	    return true;
	}
	return false;
    },

    commonality: function(left, right) {
	/* Calculate the amount that the structures left and right
	 * have in common */
        var com = 0, tot = 0;
        var elem, keysets, o, l, r, idx;
        if (this.isTerminal(left) || this.isTerminal(right)) {
            return 0;
        }

        if ((left instanceof Array) && (right instanceof Array)) {
            for (idx = 0; idx < left.length; idx++) {
                elem = left[idx];
                if (right.indexOf(elem) !== -1) {
                    com++;
                }
            }
            tot = Math.max(left.length, right.length);
        }
        else {
	    if ((left instanceof Array) || (right instanceof Array)) {
		return 0;
            }
            keysets = this.computeKeysets(left, right);
            o = keysets[0]; l = keysets[1]; r = keysets[2];
            com = o.length;
            tot = o.length + l.length + r.length;
            for (idx = 0; idx < r.length; idx++) {
                elem = r[idx];
                if (l.indexOf(elem) === -1) {
                    tot++;
                }
            }
        }
        if (tot === 0) {return 0;}
        return com / tot;
    },

    thisLevelDiff: function(left, right, key, common) {
        /* Returns a sequence of diff stanzas between the objects left
	 * and right, assuming that they are each at the position key
	 * within the overall structure. */
        var out = [], idx, okey;
        key = key !== undefined ? key : [];

        if (common === undefined) {
            common = this.commonality(left, right);
        }

        if (common) {
            var ks = this.computeKeysets(left, right);
            for (idx = 0; idx < ks[0].length; idx++) {
                okey = ks[0][idx];
                if (left[okey] !== right[okey]) {
                    out.push([key.concat([okey]), right[okey]]);
                }
            }
            for (idx = 0; idx < ks[1].length; idx++) {
                okey = ks[1][idx];
                out.push([key.concat([okey])]);
            }
            for (idx = 0; idx < ks[2].length; idx++) {
                okey = ks[2][idx];
                out.push([key.concat([okey]), right[okey]]);
            }
            return out;
        }
        if (! this.isStrictlyEqual(left, right)) {
            return [[key, right]];
        }
        return [];
    },

    keysetDiff: function(left, right, minimal, key) {
	/* Compute a diff between left and right, without treating
	 * arrays differently from objects. */
        minimal = minimal !== undefined ? minimal : true;
        var out = [], k;
        var ks = this.computeKeysets(left, right);
        for (k = 0; k < ks[1].length; k++) {
            out.push([key.concat(ks[1][k])]);
        }
        for (k = 0; k < ks[2].length; k++) {
            out.push([key.concat(ks[2][k]), right[ks[2][k]]]);
        }
        for (k = 0; k < ks[0].length; k++) {
            out = out.concat(this.diff(left[ks[0][k]], right[ks[0][k]],
                                       minimal, key.concat([ks[0][k]])));
        }
        return out;
    },

    needleDiff: function(left, right, minimal, key) {
	/* Compute a diff between left and right.  If both are arrays,
	 * a variant of Needleman-Wunsch sequence alignment is used to
	 * make the diff minimal (at a significant cost in both
	 * storage and processing).  Otherwise, the parms are passed on
	 * to keysetDiff.*/
        if (! (left instanceof Array && right instanceof Array)) {
	    return this.keysetDiff(left, right, minimal, key);
	}
        minimal = minimal !== undefined ? minimal : true;
	var down_col = 0, lastrow = [], i, sub_i, left_i, right_i, col_i;
	var row, first_left_i, left_elem, right_elem;
	var cand_length, win_length, cand, winner;

	var modify_cand = function () {
	    if (col_i + 1 < lastrow.length) {
		return lastrow[col_i+1].concat(
		    JSON_delta.diff(left_elem, right_elem,
				    minimal, key.concat([left_i]))
		);
	    }
	};

	var delete_cand = function () {
	    if (row.length > 0) {
		return row[0].concat([[key.concat([left_i])]]);
	    }
	};

	var append_cand = function () {
	    if (col_i === down_col) {
		return lastrow[col_i].concat(
		    [[key.concat([JSON_delta.appendKey(lastrow[col_i], left, key)]),
		      right_elem]]
		);
	    }
	};

	var insert_cand = function () {
	    if (col_i !== down_col) {
		return lastrow[col_i].concat(
		    [[key.concat([right_i]), right_elem, "i"]]
		);
	    }
	};

	var cand_funcs = [modify_cand, delete_cand, append_cand, insert_cand];

	for (i = 0; i <= left.length; i++) {
	    lastrow.unshift([]);
	    for (sub_i = 0; sub_i < i; sub_i++) {
		lastrow[0].push([key.concat([sub_i])]);
	    }
	}

	for (right_i = 0; right_i < right.length; right_i++) {
	    right_elem = right[right_i];
	    row = []
	    for (left_i = 0; left_i < left.length; left_i++) {
		left_elem = left[left_i];
		col_i = left.length - left_i - 1;
		win_length = Infinity;
		for (i = 0; i < cand_funcs.length; i++) {
		    cand = cand_funcs[i]();
		    if (cand !== undefined) {
			cand_length = JSON.stringify(cand).length;
			if (cand_length < win_length) {
			    winner = cand;
			    win_length = cand_length;
			}
		    }
		}
		row.unshift(winner);
	    }
	    lastrow = row;
	}
	return winner;
    },

    patchStanza: function(struc, diff) {
        /* Applies the diff stanza diff to the structure struc.
         Returns the modified structure. */
        var key = diff[0];
        switch (key.length) {
        case 0:
            struc = diff[1];
            break;
        case 1:
            if (diff.length === 1) {
                if (struc.splice === undefined) {
                    delete struc[key[0]];
                }
                else {
                    struc.splice(key[0], 1);
                }
            } else if (diff.length === 3) {
		if (struc.splice === undefined) {
                    struc[key[0]] = diff[1];
		} else {
		    struc.splice(key[0], 0, diff[1]);
		}
	    }
            else {
                struc[key[0]] = diff[1];
            }
            break;
        default:
            var pass_key = key.slice(1), pass_struc = struc[key[0]];
            var pass_diff = [pass_key].concat(diff.slice(1));
	    if (pass_struc === undefined) {
		if (typeof pass_key[0] === 'string') {
		    pass_struc = {};
		} else {
		    pass_struc = [];
		}
	    }
            struc[key[0]] = this.patchStanza(pass_struc, pass_diff);
        }
        return struc;
    }
};
