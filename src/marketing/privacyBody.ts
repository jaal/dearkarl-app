// The privacy policy, Polish first, English second. Both describe the same
// service; if they ever disagree, the Polish version binds (§11 / §11).
// Every claim here must match the code: what the D1 schema stores
// (migrations/), what the mail handler does (worker/api/email.ts), and the
// 30-day pruning in claimUnknownSenderNotice (worker/db.ts).

export const privacyUpdatedPl = "21 listopada 2026";
export const privacyUpdatedEn = "21 November 2026";

export const privacyPl = `## 1. Administrator danych

**Technologie 21 Aleksander Jaworski**
ul. Pionerska 7/2, 53-213 Wrocław
NIP: 6912215667
E-mail: hi@dearkarl.com

Ta firma jest administratorem danych osobowych opisanych niżej. Nie wyznaczyliśmy
inspektora ochrony danych. We wszystkich sprawach dotyczących danych pisz na
hi@dearkarl.com.

Polityka obejmuje stronę dearkarl.com, aplikację pod dearkarl.com/app, adresy
Karla w domenie in.dearkarl.com, serwer MCP pod dearkarl.com/mcp oraz listę
oczekujących.

## 2. W skrócie

- Karl zapisuje maile, które sam mu przekazujesz, w folderze na **Twoim** Dysku
  Google. Treści maili nie przechowujemy na naszych serwerach.
- Nie prosimy o dostęp do Twojej skrzynki pocztowej. Dostęp do Dysku obejmuje
  tylko pliki, które Karl sam utworzył (zakres Google \`drive.file\`). Reszty
  Dysku Karl nie widzi.
- Przechowujemy tylko to, czego usługa potrzebuje do działania: Twój adres
  e-mail, Twój adres Karla, tokeny dostępu Google i dane sesji.
- Nie sprzedajemy danych, nie profilujemy, nie mamy analityki ani reklam.

## 3. Jakie dane przetwarzamy, po co i jak długo

| Dane | Po co | Podstawa prawna | Jak długo |
|---|---|---|---|
| Adres e-mail Twojego konta Google | Identyfikacja konta; rozpoznanie, że mail do Karla pochodzi od Ciebie; powiadomienia o działaniu usługi | art. 6 ust. 1 lit. b RODO (wykonanie umowy) | Do usunięcia konta |
| Twój adres Karla (\`claude-…@in.dearkarl.com\`) | Kierowanie poczty do właściwego konta | art. 6 ust. 1 lit. b | Do usunięcia konta |
| Tokeny dostępu Google | Zapis maili w Twoim folderze i odczyt folderu, gdy prosi o to Twój asystent AI | art. 6 ust. 1 lit. b | Do usunięcia konta albo cofnięcia dostępu w Google |
| Identyfikator sesji (cookie \`sid\`) | Utrzymanie zalogowania w aplikacji | art. 6 ust. 1 lit. b | Do wylogowania albo wygaśnięcia dostępu Google |
| Tokeny API do MCP | Uwierzytelnienie Twojego klienta AI. Przechowujemy tylko skrót (hash) tokenu, jego początek, nazwę i daty, nigdy cały token | art. 6 ust. 1 lit. b | Do usunięcia konta |
| Treść przekazanych maili | Zamiana na markdown i zapis w Twoim folderze | art. 6 ust. 1 lit. b | Nie przechowujemy jej: jest przetwarzana w pamięci tylko przez czas zapisu (§4) |
| Adres osoby bez konta, która napisała do Karla, i data naszej odpowiedzi | Ograniczenie odpowiedzi „nie znam tego adresu” do jednej na dobę, żeby spam nie generował poczty | art. 6 ust. 1 lit. f (uzasadniony interes: ochrona przed nadużyciami) | Do 30 dni |
| Dane techniczne żądań (adres IP, czas, adres strony, przeglądarka) i logi błędów | Działanie i ochrona serwisu | art. 6 ust. 1 lit. f | Kilka dni, zgodnie z okresem przechowywania Cloudflare. Logi nie zawierają treści maili |
| Adres e-mail z listy oczekujących | Jednorazowa informacja o starcie usługi | art. 6 ust. 1 lit. a (zgoda) | Do startu usługi albo cofnięcia zgody |
| Zgoda na „build notes” (jeśli ją zaznaczysz) | Okazjonalne maile o tym, co zmieniliśmy | art. 6 ust. 1 lit. a (zgoda) | Do cofnięcia zgody |

Podanie danych jest dobrowolne, ale bez konta Google i dostępu do folderu na
Dysku usługa nie może działać.

## 4. Poczta, która przechodzi przez Karla

- Mail wysłany na Twój adres Karla trafia przez Cloudflare Email Routing do
  naszego programu. Program zamienia go w pamięci na markdown i zapisuje jako
  plik w folderze \`dearkarl\` na Twoim Dysku. Temat maila staje się nazwą
  pliku. Załączników nie zapisujemy.
- Treści, tematu ani nadawcy maila nie zapisujemy w żadnej bazie, na dysku ani
  w kolejce po naszej stronie.
- Karl przyjmuje pocztę tylko z adresu Twojego konta. Maila z innego adresu nie
  zapisuje; nadawca dostaje krótką odpowiedź, najwyżej raz na dobę.
- Maile, które nie przeszły weryfikacji nadawcy (SPF albo DMARC), odrzucamy bez
  zapisu.
- Po każdym zapisanym mailu wysyłamy Ci krótkie potwierdzenie. Piszemy też, gdy
  zapis się nie udał albo gdy dostęp do Dysku wygasł.
- Gdy Twój klient AI (np. Claude Code) pyta przez MCP o pocztę, czytamy pliki
  z Twojego folderu i przekazujemy je temu klientowi. Od tej chwili treść
  przetwarza dostawca Twojego AI (np. Anthropic) na zasadach Twojej umowy z nim.
  Nie jesteśmy stroną tej umowy.
- Treść maili traktujemy jako dane, nigdy jako polecenia dla Twojego AI.

## 5. Komu przekazujemy dane

Korzystamy z kilku dostawców, którzy przetwarzają dane w naszym imieniu
i wyłącznie na nasze polecenie:

| Dostawca | Rola | Jakie dane |
|---|---|---|
| **Cloudflare, Inc.** (USA) | Hosting strony i aplikacji, baza danych, odbiór poczty | Wszystkie dane z §3 poza listą oczekujących; treść maili tylko w trakcie przetwarzania |
| **Elastic Email Inc.** (Kanada) | Wysyłka powiadomień z adresu karl@mail.dearkarl.com | Adres odbiorcy oraz temat i treść powiadomienia. Treści Twoich maili nie dostaje |
| **Tally BV** (Belgia) | Formularz listy oczekujących | Adres e-mail i odpowiedź o build notes |

**Google** (Google Ireland Limited) obsługuje logowanie i Twój Dysk. W tym
zakresie jest odrębnym administratorem danych Twojego konta Google, na zasadach
swojej polityki prywatności: policies.google.com/privacy.

Nie sprzedajemy, nie wynajmujemy i nie udostępniamy danych w celach
marketingowych, także w razie sprzedaży albo zamknięcia dearkarl.

## 6. Przekazywanie danych poza EOG

Cloudflare przetwarza dane także w USA. Podstawą jest certyfikacja Cloudflare
w programie EU–US Data Privacy Framework oraz standardowe klauzule umowne
Komisji Europejskiej. Elastic Email działa w Kanadzie, wobec której Komisja
Europejska wydała decyzję stwierdzającą odpowiedni stopień ochrony danych.

## 7. Cookies i pamięć przeglądarki

Ustawiamy jedno cookie: \`sid\`, potrzebne do utrzymania zalogowania.
Jest niezbędne do działania usługi, więc nie wymaga zgody. Aplikacja zapisuje też
w pamięci sesji przeglądarki (\`sessionStorage\`) etap, na którym jesteś
w kreatorze. Nie używamy cookies analitycznych ani reklamowych, pikseli
śledzących ani narzędzi do nagrywania sesji, dlatego nie ma banera cookies.

## 8. Twoje prawa

Masz prawo do dostępu do swoich danych, ich sprostowania, usunięcia,
ograniczenia przetwarzania i przeniesienia. Możesz wnieść sprzeciw wobec
przetwarzania opartego na uzasadnionym interesie. Zgodę możesz cofnąć w każdej
chwili; nie wpływa to na zgodność z prawem wcześniejszego przetwarzania.

- **Usunięcie konta:** napisz z adresu konta na hi@dearkarl.com. Usuniemy konto
  i dane z §3 w ciągu 7 dni. Folder i pliki na Twoim Dysku zostają, bo są Twoje.
- **Cofnięcie dostępu do Dysku:** w każdej chwili w ustawieniach konta Google
  (myaccount.google.com/permissions). Karl przestaje wtedy zapisywać pocztę.
- **Skarga:** możesz ją złożyć do Prezesa Urzędu Ochrony Danych Osobowych,
  ul. Stawki 2, 00-193 Warszawa, uodo.gov.pl.

Nie podejmujemy decyzji w sposób zautomatyzowany i nie profilujemy.

## 9. Bezpieczeństwo

Cały ruch jest szyfrowany (TLS). Tokeny API przechowujemy wyłącznie jako skróty.
Dostęp do bazy danych ma tylko osoba wskazana w §1. Twój adres Karla zawiera
losowy ciąg znaków, a Karl i tak przyjmuje pocztę tylko od Ciebie.

## 10. Dzieci

Usługa nie jest przeznaczona dla osób poniżej 16 lat i świadomie nie zbieramy
ich danych.

## 11. Zmiany i wersje językowe

O istotnych zmianach tej polityki informujemy na tej stronie, a posiadaczy kont
także mailem. Polityka jest dostępna po polsku i po angielsku; w razie
rozbieżności wiążąca jest wersja polska.

**Ostatnia aktualizacja:** ${privacyUpdatedPl}`;

export const privacyEn = `## 1. Data controller

**Technologie 21 Aleksander Jaworski**
Pionerska 7/2, 53-213 Wrocław, Poland
NIP (tax ID): 6912215667
E-mail: hi@dearkarl.com

This business is the controller of the personal data described below. We have
not appointed a data protection officer. Write to hi@dearkarl.com about anything
to do with your data.

This notice covers dearkarl.com, the app at dearkarl.com/app, Karl addresses at
in.dearkarl.com, the MCP server at dearkarl.com/mcp, and the waiting list.

## 2. In short

- Karl saves the mail you choose to forward to him in a folder in **your** Google
  Drive. We do not keep the content of your mail on our servers.
- We never ask for access to your mailbox. Drive access covers only the files
  Karl created himself (Google's \`drive.file\` scope). Karl cannot see the rest
  of your Drive.
- We keep only what the service needs to work: your email address, your Karl
  address, your Google access tokens and session data.
- We do not sell data, build profiles, run analytics or show ads.

## 3. What we process, why, and for how long

| Data | Why | Legal basis | How long |
|---|---|---|---|
| The email address of your Google account | Identifying your account; recognising that mail to Karl came from you; notices about the service | Art. 6(1)(b) GDPR (performance of a contract) | Until you delete the account |
| Your Karl address (\`claude-…@in.dearkarl.com\`) | Routing mail to the right account | Art. 6(1)(b) | Until you delete the account |
| Google access tokens | Saving mail into your folder, and reading the folder when your AI assistant asks | Art. 6(1)(b) | Until you delete the account or revoke access in Google |
| Session identifier (\`sid\` cookie) | Keeping you signed in to the app | Art. 6(1)(b) | Until you log out or Google access expires |
| MCP API tokens | Authenticating your AI client. We store only a hash of the token, its first characters, its name and dates — never the token itself | Art. 6(1)(b) | Until you delete the account |
| The content of forwarded mail | Turning it into markdown and saving it in your folder | Art. 6(1)(b) | Not stored: processed in memory only while it is being saved (§4) |
| The address of someone without an account who wrote to Karl, and when we replied | Limiting the "I don't know this address" reply to one a day, so spam cannot generate mail | Art. 6(1)(f) (legitimate interest: preventing abuse) | Up to 30 days |
| Request data (IP address, time, page, browser) and error logs | Running and protecting the service | Art. 6(1)(f) | A few days, as Cloudflare retains them. Logs never contain the content of mail |
| Waiting-list email address | Telling you once when the service launches | Art. 6(1)(a) (consent) | Until launch or until you withdraw consent |
| Build-notes consent, if you tick it | Occasional mail about what changed | Art. 6(1)(a) (consent) | Until you withdraw consent |

Giving us this data is voluntary, but without a Google account and access to a
Drive folder the service cannot work.

## 4. Mail that passes through Karl

- Mail sent to your Karl address reaches our program through Cloudflare Email
  Routing. The program turns it into markdown in memory and saves it as a file in
  the \`dearkarl\` folder in your Drive. The subject becomes the file name.
  Attachments are not saved.
- We do not write the content, subject or sender of your mail to any database,
  disk or queue of ours.
- Karl accepts mail only from your account's address. Mail from any other address
  is not saved; the sender gets a short reply, at most once a day.
- Mail that fails sender authentication (SPF or DMARC) is dropped without being
  saved.
- After each saved mail we send you a short confirmation. We also write when a
  save failed or when Drive access has expired.
- When your AI client (for example Claude Code) asks for your mail over MCP, we
  read the files in your folder and pass them to that client. From then on the
  content is processed by your AI provider (for example Anthropic) under your own
  agreement with them. We are not a party to that agreement.
- We treat the content of mail as data, never as instructions to your AI.

## 5. Who receives data

We use a few providers that process data on our behalf and only on our
instructions:

| Provider | Role | What data |
|---|---|---|
| **Cloudflare, Inc.** (United States) | Hosting the site and app, the database, receiving mail | Everything in §3 except the waiting list; mail content only while it is processed |
| **Elastic Email Inc.** (Canada) | Sending notices from karl@mail.dearkarl.com | The recipient's address and the notice's subject and text. It never gets the content of your mail |
| **Tally BV** (Belgium) | The waiting-list form | Email address and the build-notes answer |

**Google** (Google Ireland Limited) handles sign-in and your Drive. For that it is
a separate controller of your Google account data, under its own privacy policy:
policies.google.com/privacy.

We never sell, rent or share data for marketing, including if dearkarl is ever
sold or shut down.

## 6. Transfers outside the EEA

Cloudflare also processes data in the United States, on the basis of its
certification under the EU–US Data Privacy Framework and the European
Commission's Standard Contractual Clauses. Elastic Email operates in Canada,
which the European Commission recognises as providing adequate protection.

## 7. Cookies and browser storage

We set one cookie, \`sid\`, which keeps you signed in. It is strictly necessary
for the service, so it needs no consent. The app also keeps the step you are on
in the setup wizard in your browser's session storage (\`sessionStorage\`). We use
no analytics or advertising cookies, no tracking pixels and no session recording,
so there is no cookie banner.

## 8. Your rights

You have the right to access, correct, delete, restrict and port your data. You
can object to processing based on legitimate interest. You can withdraw consent
at any time; this does not affect processing done before.

- **Deleting your account:** write from your account's address to
  hi@dearkarl.com. We delete the account and the data in §3 within 7 days. The
  folder and files in your Drive stay where they are, because they are yours.
- **Revoking Drive access:** at any time in your Google account settings
  (myaccount.google.com/permissions). Karl then stops saving mail.
- **Complaints:** you can lodge one with the Polish supervisory authority,
  Prezes Urzędu Ochrony Danych Osobowych, ul. Stawki 2, 00-193 Warszawa,
  uodo.gov.pl.

We make no automated decisions and do no profiling.

## 9. Security

All traffic is encrypted (TLS). API tokens are stored only as hashes. Only the
person named in §1 has access to the database. Your Karl address contains a
random string, and Karl accepts mail from you alone anyway.

## 10. Children

The service is not meant for anyone under 16, and we do not knowingly collect
their data.

## 11. Changes and language versions

We announce material changes to this notice on this page, and to account holders
also by email. This notice exists in Polish and English; if they differ, the
Polish version prevails.

**Last updated:** ${privacyUpdatedEn}`;
