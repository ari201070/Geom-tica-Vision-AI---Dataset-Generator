async function test() {
  const res = new Response("<!doctype html>", { status: 504 });
  try {
    let errStr = "";
    try {
      const errJSON = await res.json();
      errStr = "json";
    } catch (e) {
      console.log("JSON parse failed");
      errStr = await res.text();
      console.log("Text:", errStr);
    }
  } catch (e) {
    console.log("Outer catch:", e.message);
  }
}
test();
