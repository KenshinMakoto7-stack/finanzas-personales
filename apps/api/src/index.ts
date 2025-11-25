import "dotenv/config";
import app from "./server/app.js";

const PORT = Number(process.env.PORT || 4000);
app.listen(PORT, () => {
  console.log(`API escuchando en http://localhost:${PORT}`);
});


