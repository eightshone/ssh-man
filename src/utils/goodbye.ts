import { GOODBYES } from "./consts";

function goodbye() {
  console.log(GOODBYES[Math.floor(Math.random() * GOODBYES.length)]);
}

export default goodbye;
