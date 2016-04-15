var pmathmlToMQ = (function () {
  var PmmlOps = {}

  PmmlOps['·'] = "cdot"
  PmmlOps['+'] = "+"

  function commandToBlock(cmd) {
    var block = MathBlock();
    cmd.adopt(block, 0, 0);
    return block;
  }
  function joinBlocks(blocks) {
    var firstBlock = blocks[0] || MathBlock();
    
    for (var i = 1; i < blocks.length; i += 1) {
      blocks[i].children().adopt(firstBlock, firstBlock.ends[R], 0);
    }
    
    return firstBlock;
  }
  function pmathmlToBlock(math) {
    if (math instanceof Text) {
      //if (math.textContent.search(/^\s*$/) >= 0)
      //return MathBlock();
      throw TypeError("expected Element, not non-whitespace text node");
    }
    if (!(math instanceof Element)) throw TypeError("expected Element, not "+math);

    var tag = math.tagName.toLowerCase();
    var children = math.children;
    var block = undefined;

    if (tag=="math" | tag=="mrow") {
      blocks = [];
      for (var i=0; i<children.length; i++)
	blocks.push(pmathmlToBlock(children[i]));
      block = joinBlocks(blocks);
    } else if (tag=="msup") {
      if (children.length != 2)
	throw Error("msup must have exactly two children");

      var base = pmathmlToBlock(children[0]);
      var sup = LatexCmds['^']();
      var arg = pmathmlToBlock(children[1]);

      sup.blocks = [arg];
      arg.adopt(sup, sup.ends[R], 0);

      sup.adopt(base, base.ends[R], 0);
      block = base; // joinBlocks([base,commandToBlock(sup)]);
    } else if (tag=="msqrt") {
      if (children.length != 1)
	throw Error("msqrt must have exactly one child");

      var sqrt = SquareRoot();
      var arg = pmathmlToBlock(children[0]);
      sqrt.blocks = [arg];
      arg.adopt(sqrt, sqrt.ends[R], 0);
      block = commandToBlock(sqrt);
    } else if (tag=="mi") {
      var v = math.textContent.trim();
      if (v.length!=1)
	throw Error("Only single character variable names supported");
      var vc = Variable(v,v);
      block = commandToBlock(vc);
    } else if (tag=="mo") {
      var op = math.textContent.trim();
      var cmd = null;
      /* if (op.startsWith("\\")) 
	cmd = LatexCmds[op.substr(1)]
      else
	cmd = LatexCmds[op] || CharCmds[op]; */
      var ctrlSeq = PmmlOps[op]
      if (ctrlSeq==null)
	throw Error("Unknown operator "+op);
      cmd = LatexCmds[ctrlSeq];
      if (cmd==null)
	throw Error("Operator "+op+" leads to unknown ctrl seq "+ctrlSeq);
      var op2 = cmd();
      block = commandToBlock(op2);
    } else if (tag=="mfrac") {
      if (children.length != 2)
	throw Error("mfrac must have exactly two children");

      var frac = Fraction();
      var arg1 = pmathmlToBlock(children[0]);
      var arg2 = pmathmlToBlock(children[1]);
      frac.blocks = [arg1,arg2];
      arg1.adopt(frac, frac.ends[R], 0);
      arg2.adopt(frac, frac.ends[R], 0);
      block = commandToBlock(frac);
    } else if (tag=="mn") {
      var n = math.textContent.trim();
      if (n.search(/^[0-9]+$/)==-1)
	throw Error("Only decimal integers supported, not '"+n+"'");
      var blocks = [];
      for (var i=0; i<n.length; i++)
	blocks.push(commandToBlock(Digit(n[i])));
      block = joinBlocks(blocks);
    } else if (tag=="mfenced") {
      var open = math.getAttribute('open')
      var close = math.getAttribute('close')
      if (open==null) open="(";
      if (close==null) close=")";
      var ctrlSeq = open;
      if (ctrlSeq=="{" || ctrlSeq=="[" || ctrlSeq=="}" || ctrlSeq=="]")
	ctrlSeq = '\\' + ctrlSeq;
      var end = close;
      if (end=="{" || end=="[" || end=="}" || end=="]")
	end = '\\' + end;
      
      var bracket = Bracket(0, open, close, ctrlSeq, end);
      var content = [];
      for (var i=0; i<children.length; i++)
	content.push(pmathmlToBlock(children[i]));
      content = joinBlocks(content);
      bracket.blocks = [ content ];
      content.adopt(bracket, 0, 0);
      block = commandToBlock(bracket);
    } else {
      throw Error("Unsupported Presentation MathML tag '"+tag+"'");
    }

    if (block==null) throw Error();
    if (!(block instanceof MathBlock))
      throw Error();
    return block;
  }

  return {pmathmlToBlock:pmathmlToBlock};
})();

console.log("pmathmlToMQ",pmathmlToMQ);

Controller.open(function(_, super_) {
  _.writePMML = function(math) {
    var cursor = this.notify('edit').cursor;
    
    var block = pmathmlToMQ.pmathmlToBlock(math);
    
    if (block && !block.isEmpty()) {
      block.children().adopt(cursor.parent, cursor[L], cursor[R]);
      var jQ = block.jQize();
      jQ.insertBefore(cursor.jQ);
      cursor[L] = block.ends[R];
      block.finalizeInsert(cursor.options, cursor);
      if (block.ends[R][R].siblingCreated) block.ends[R][R].siblingCreated(cursor.options, L);
      if (block.ends[L][L].siblingCreated) block.ends[L][L].siblingCreated(cursor.options, R);
      cursor.parent.bubble('reflow');
    }
    
    return this;
  };
});

