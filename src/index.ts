import app from "./app";
import { env } from "./config/env";

app.listen(env.PORT, () => {
    console.log(`Server běží na http://localhost:${env.PORT}`);
});
