import { ky, DOMParser } from "./api/deps.ts";

type Hamugo = {
    word: string;
    meaning: string;
    hint: string;
    example: string;
};

const HAMUGO_PREFIX = "https://www.nintendo.co.jp/n02/dmg/b86j/";
const HAMUGO_PAGE_RANGE = Array.from({ length: 9 }, (_, i) => i + 1);

// hamugo word
// body > center:nth-child(7) > table > tbody > tr:nth-child(1) > td:nth-child(2) > img
// data.getAttribute("alt")

// hamugo hint
// body > center:nth-child(7) > table > tbody > tr:nth-child(1) > td:nth-child(3) > table > tbody > tr > td:nth-child(2) > b

// hamugo meaning
// body > center:nth-child(7) > table > tbody > tr:nth-child(2) > td > img
// data.getAttribute("alt")

// hamugo description, example
// body > center:nth-child(9) > table > tbody > tr > td

// hamugo01 page
// first hamugo item
// body > center:nth-child(7)
// body > center:nth-child(9)

// last hamugo item
// body > center:nth-child(42)
// body > center:nth-child(44)

// hamugo02 ~ 09
// first hamugo item
// body > center:nth-child(5)
// body > center:nth-child(7)

// body > center:nth-child(12)
// body > center:nth-child(14)

// last hamugo item
// body > center:nth-child(68)
// body > center:nth-child(70)

// hamugo05,06,07 last item
// body > center:nth-child(67)
// body > center:nth-child(69)

// Special thanks @arrow2nd
// from https://github.com/arrow2nd/imas-artwork-api/blob/main/tools/libs/fetch.ts
const getHtmlUtf8 = async (res: Response): Promise<string> => {
    const resBuf = await res.arrayBuffer();
    const text = new TextDecoder().decode(resBuf);

    // convert to UTF-8 if charset is Shift-JIS
    return text.includes("text/html; charset=Shift_JIS") ? new TextDecoder("shift-jis").decode(resBuf) : text;
};

const getHamugoItems = async (page: number): Promise<Hamugo[]> => {
    const res = await ky(`hamugo0${page}/index.html`, { prefixUrl: HAMUGO_PREFIX });
    const html = await getHtmlUtf8(res);
    const dom = new DOMParser().parseFromString(html, "text/html");

    if (!dom) {
        throw new Error("DOM parse failed");
    }

    const firstPage = page === 1;
    const firstItemIndex = firstPage ? 7 : 5;
    const itemCount = firstPage ? 6 : 10;

    return Array.from({ length: itemCount }, (_, i) => i).map((index) => {
        const childItemIndex = firstItemIndex + index * 7;
        const mainBodyExist = dom.querySelector(`body > center:nth-child(${childItemIndex}) > table > tbody`);
        const mainBody = mainBodyExist ?? dom.querySelector(`body > center:nth-child(${childItemIndex - 1}) > table > tbody`)!;
        const childExampleIndex = mainBodyExist ? childItemIndex + 2 : childItemIndex + 3;

        const wordImg = mainBody.querySelector(`tr:nth-child(1) > td:nth-child(2) > img`)!;
        const word = wordImg.getAttribute("alt")!;

        const hintB = mainBody.querySelector(`tr:nth-child(1) > td:nth-child(3) > table > tbody > tr > td:nth-child(2) > b`)!;
        const hintFont = hintB.querySelector("font")!;
        hintB.removeChild(hintFont);
        const hint = hintB.textContent;

        const meaningImg = mainBody.querySelector(`tr:nth-child(2) > td > img`)!;
        const meaning = meaningImg.getAttribute("alt")!;

        const exampleTd = dom.querySelector(`body > center:nth-child(${childExampleIndex}) > table > tbody > tr > td`)!;
        const exampleTdFont = exampleTd.querySelector("font")!;
        exampleTd.removeChild(exampleTdFont);
        const example = exampleTd.innerText;

        return { word, meaning, hint, example };
    });
};

const promises = HAMUGO_PAGE_RANGE.map(getHamugoItems);
const hamugoItems = (await Promise.all(promises)).flat();

const encoder = new TextEncoder();
const data = encoder.encode(JSON.stringify(hamugoItems));
await Deno.writeFile("hamugo.json", data);

console.log(
    hamugoItems.length,
    hamugoItems.map((hamugo) => hamugo.word)
);
