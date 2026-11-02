# Requirements Document

## Introduction

Este spec es el segundo de cuatro en que se divide la evolución de Focus Garden hacia cuentas y sincronización (ver `exercise/docs/current-plan.md`). Construye **solo la autenticación** con Amazon Cognito: registro, inicio de sesión y cierre de sesión. No construye el guardado ni la sincronización de datos en la nube, que son responsabilidad del spec 3 (`cloud-sync`), ni la sección "Mis sesiones", que es del spec 4 (`multi-device-sessions`). El segundo factor (2FA) se difiere a una iteración posterior.

La autenticación es **opcional**: quien no quiera cuenta sigue usando la app sin cuenta, igual que hoy. Crear una cuenta no toca los datos locales de `localStorage`; la migración de esos datos a la nube es del spec 3.

Este spec agrega, por primera vez en el proyecto, una página propia de registro e inicio de sesión dentro de la App con el estilo de Focus Garden, y un pequeño backend aparte: un puente OIDC en Node.js con Express que permite iniciar sesión con GitHub, proveedor que Cognito no soporta de forma nativa. Los demás proveedores sociales (Google, Meta y Login with Amazon) se resuelven con el Hosted UI de Cognito usando OAuth 2.0 con código de autorización y PKCE.

Este spec contradice el principio de producto 6 ("datos locales, sin cuentas ni servidor") y el stack de `tech.md` ("sin backend, sin build"). La documentación debe reconocer y resolver esa tensión.

## Glossary

- **App**: La aplicación Focus Garden (una SPA con pestañas por hash), servida desde `app.html`.
- **Landing**: Página `index.html`, aparte de la App, con scroll normal, que presenta Focus Garden y es la forma de entrar a la App.
- **Auth_Service**: La parte de la App encargada de la autenticación: la página de cuenta, el manejo de tokens y la comunicación con Amazon Cognito y el OIDC_Bridge.
- **Cognito**: El servicio Amazon Cognito (User Pool más dominio de Hosted UI) que gestiona identidades y emite los tokens.
- **Hosted_UI**: La página de inicio de sesión alojada por Cognito en el dominio configurado, usada solo para el redirect de los proveedores sociales.
- **Auth_Page**: Página propia de registro e inicio de sesión dentro de la App, con el estilo de Focus Garden, servida en la ruta hash `#/cuenta`.
- **Auth_Config**: Archivo versionado `src/core/auth-config.js` con los valores **públicos** de configuración de la autenticación: User Pool ID, App Client ID público, dominio de Cognito, redirect URIs y el endpoint del OIDC_Bridge.
- **Social_Provider**: Proveedor de identidad externo integrado por Cognito de forma nativa: Google, Meta (Facebook/Instagram) y Login with Amazon.
- **GitHub_Provider**: Inicio de sesión con GitHub, resuelto a través del OIDC_Bridge porque Cognito no lo soporta de forma nativa.
- **OIDC_Bridge**: Servicio aparte en Node.js con Express puro que traduce el inicio de sesión de GitHub a un proveedor OIDC que Cognito acepta. Guarda los secretos fuera del frontend.
- **PKCE**: Proof Key for Code Exchange, la extensión de OAuth 2.0 que protege el flujo de código de autorización de un cliente público sin secreto.
- **State_Value**: Valor aleatorio generado por la App para cada inicio de sesión, enviado a Cognito y verificado al volver, que protege contra peticiones falsificadas (CSRF) en el redirect.
- **Auth_Tokens**: El conjunto de tokens que emite Cognito tras un inicio de sesión correcto: el ID token, el access token y el refresh token.
- **Session**: El estado de haber iniciado sesión en este dispositivo, representado por los Auth_Tokens válidos y la Display_Name de la persona.
- **Display_Name**: El nombre que la persona escribe tras registrarse, guardado como atributo del usuario en Cognito.
- **Name_Prompt**: Pantalla que, tras un registro correcto, pide únicamente la Display_Name.
- **Garden_Button**: Botón con el texto "Ir a mi Garden" que aparece en el Name_Prompt cuando la persona ha escrito una Display_Name, y que lleva a la App.
- **Settings_View**: Componente `<settings-view>` del módulo `settings`.
- **Account_Slot**: Bloque de la Settings_View que en el spec anterior era un Reserved_Slot "Mi cuenta" marcado "Próximamente" y que este spec reemplaza por la cuenta real.
- **Create_Account_Button**: Botón de la Landing que hoy abre la hoja "Próximamente" (`openComingSoonSheet` en `src/components/landing-sheets.js`) y que este spec conecta con el registro real.
- **Store**: Estado único de la App en `src/core/store.js`.
- **Local_Data**: Las tareas, rondas y ajustes guardados en `localStorage` bajo la clave `jardin-movil:v1`.
- **Account_SDK**: El cliente de Cognito que la App carga por CDN para hablar con Cognito desde el navegador.

## Requirements

### Requirement 1: Página de cuenta en la App

**User Story:** Como persona que quiere mantener su progreso, quiero una página propia de registro e inicio de sesión con el estilo de Focus Garden, para crear mi cuenta sin salir de la experiencia de la app.

#### Acceptance Criteria

1. WHEN `app.html` is opened with the URL hash `#/cuenta`, THE App SHALL display the Auth_Page.
2. THE Auth_Page SHALL display a registration form, a sign-in form and the buttons of the Social_Provider and the GitHub_Provider.
3. THE Auth_Page SHALL use the design tokens `cream`, `paper`, `ink`, `moss`, `leaf` and `line`, and the system rounded font, consistent with `design-system.md`.
4. THE Auth_Page SHALL keep every button, link and input at a touch target of at least 44 px of height, and SHALL size text inputs at 16 px to avoid the automatic zoom on iOS.
5. WHILE no Session exists, THE Auth_Page SHALL allow the person to return to the App without an account.
6. THE Auth_Page SHALL expose each form control with an associated label and an `aria-label` where the control shows only an icon.

### Requirement 2: Registro con usuario y contraseña

**User Story:** Como persona nueva, quiero registrarme con mi correo y una contraseña, para tener una cuenta propia en Focus Garden.

#### Acceptance Criteria

1. WHEN the person submits the registration form with a correo and a contraseña, THE Auth_Service SHALL request Cognito to create a user in the User Pool.
2. WHEN Cognito creates the user, THE Auth_Service SHALL inform the person that a confirmation code was sent to the correo and SHALL display a field to enter that code.
3. WHEN the person submits the confirmation code, THE Auth_Service SHALL request Cognito to confirm the account and SHALL proceed to the Name_Prompt defined in Requirement 6.
4. IF the correo is already registered, THEN THE Auth_Service SHALL display a message that the correo is already in use and SHALL offer the sign-in form.
5. IF the contraseña does not meet the policy of the User Pool, THEN THE Auth_Service SHALL display the unmet rules before sending the request.
6. IF the confirmation code is incorrect or expired, THEN THE Auth_Service SHALL display an error message and SHALL offer to resend the code.

### Requirement 3: Inicio de sesión con usuario y contraseña

**User Story:** Como persona con cuenta, quiero iniciar sesión con mi correo y contraseña, para recuperar mi sesión en este dispositivo.

#### Acceptance Criteria

1. WHEN the person submits the sign-in form with a correo and a contraseña, THE Auth_Service SHALL request Cognito to authenticate the user.
2. WHEN Cognito returns the Auth_Tokens, THE Auth_Service SHALL store the Auth_Tokens as defined in Requirement 9 and SHALL establish the Session.
3. IF the credentials are incorrect, THEN THE Auth_Service SHALL display a message that the correo or the contraseña are wrong, without stating which one.
4. IF the account is not yet confirmed, THEN THE Auth_Service SHALL offer to resend the confirmation code and continue the confirmation defined in Requirement 2.
5. WHEN a Session is established, THE App SHALL navigate to the Tareas tab unless the Display_Name is missing, in which case THE App SHALL proceed to the Name_Prompt as defined in Requirement 6.

### Requirement 4: Inicio con proveedores sociales (Google, Meta, Login with Amazon)

**User Story:** Como persona que prefiere usar una cuenta que ya tengo, quiero iniciar sesión con Google, Meta o mi cuenta de Amazon, para no crear otra contraseña.

#### Acceptance Criteria

1. THE Auth_Page SHALL display one button for each Social_Provider: Google, Meta and Login with Amazon.
2. WHEN the person taps a Social_Provider button, THE Auth_Service SHALL start the OAuth 2.0 authorization-code flow with PKCE and a State_Value, and SHALL redirect to the Hosted_UI of Cognito for that provider.
3. WHEN Cognito redirects back to a redirect URI of the Auth_Config with an authorization code, THE Auth_Service SHALL verify that the returned State_Value matches the one it sent before exchanging the code.
4. WHEN the State_Value matches, THE Auth_Service SHALL exchange the authorization code together with the PKCE verifier for the Auth_Tokens and SHALL establish the Session.
5. IF the returned State_Value does not match the one sent, THEN THE Auth_Service SHALL discard the response and display an error without establishing a Session.
6. IF the person cancels the flow at the Hosted_UI, THEN THE Auth_Service SHALL return to the Auth_Page without an error message.
7. WHEN a Session is established through a Social_Provider and the Display_Name is missing, THE App SHALL proceed to the Name_Prompt defined in Requirement 6.

### Requirement 5: Inicio con GitHub mediante el puente OIDC

**User Story:** Como persona desarrolladora, quiero iniciar sesión con mi cuenta de GitHub, para entrar con la identidad que ya uso para el código.

#### Acceptance Criteria

1. THE Auth_Page SHALL display one button to sign in with the GitHub_Provider.
2. WHEN the person taps the GitHub_Provider button, THE Auth_Service SHALL start the OAuth 2.0 authorization-code flow with PKCE and a State_Value against Cognito, using the OIDC_Bridge as the identity provider.
3. THE OIDC_Bridge SHALL exchange the GitHub authorization with GitHub and SHALL present the result to Cognito as an OIDC provider that Cognito accepts.
4. WHEN Cognito redirects back with an authorization code after the GitHub flow, THE Auth_Service SHALL verify the State_Value and exchange the code as defined for the Social_Provider in Requirement 4.
5. IF the OIDC_Bridge is unreachable, THEN THE Auth_Service SHALL display a message that sign-in with GitHub is unavailable and SHALL keep the other sign-in methods functional.
6. THE Auth_Service SHALL read the endpoint of the OIDC_Bridge from the Auth_Config and SHALL NOT embed any GitHub secret in the frontend.

### Requirement 6: Nombre tras el registro y repregunta al iniciar sesión

**User Story:** Como persona recién registrada, quiero que me pidan solo mi nombre y un botón para entrar a mi jardín, para empezar rápido y sin formularios largos.

#### Acceptance Criteria

1. WHEN a registration completes through any method and the Display_Name is missing, THE App SHALL display the Name_Prompt that asks only for the Display_Name.
2. WHEN the person enters a Display_Name in the Name_Prompt, THE Auth_Service SHALL save the Display_Name as a user attribute in Cognito and THE Name_Prompt SHALL display the Garden_Button with the text "Ir a mi Garden".
3. WHEN the person taps the Garden_Button, THE App SHALL navigate to the Tareas tab.
4. WHEN the person leaves the Name_Prompt without entering a Display_Name, THE App SHALL navigate to the Tareas tab without saving a Display_Name.
5. WHEN a person whose Display_Name is missing signs in again, THE App SHALL display the Name_Prompt before reaching the Tareas tab.
6. THE Name_Prompt SHALL NOT ask for any data other than the Display_Name.

### Requirement 7: Cuenta y cierre de sesión en Ajustes

**User Story:** Como persona con sesión iniciada, quiero ver mi estado de cuenta en Ajustes y poder cerrar sesión, para controlar mi acceso desde un lugar claro.

#### Acceptance Criteria

1. THE Settings_View SHALL replace the Reserved_Slot "Mi cuenta" with the Account_Slot that shows the real account state.
2. WHILE a Session exists, THE Account_Slot SHALL display the Display_Name, or the correo when the Display_Name is missing, and a control to cerrar sesión.
3. WHILE no Session exists, THE Account_Slot SHALL display a control that navigates to the Auth_Page to crear cuenta or iniciar sesión.
4. WHEN the person activates the control to cerrar sesión, THE Auth_Service SHALL discard the stored Auth_Tokens, end the Session and show the toast "Sesión cerrada".
5. WHEN the Session ends, THE Store SHALL keep every task, round and setting of the Local_Data unchanged.
6. THE Settings_View SHALL keep the Reserved_Slot "Mis sesiones" with the label "Próximamente", because it belongs to a later spec.

### Requirement 8: Opcionalidad y coexistencia con el modo sin cuenta

**User Story:** Como persona que solo quiere probar la app, quiero poder usarla sin cuenta como siempre, para no verme obligada a registrarme.

#### Acceptance Criteria

1. THE App SHALL remain fully usable without a Session, keeping tasks, pomodoro, jardín 3D and estadísticas working from the Local_Data.
2. WHEN the person taps the Create_Account_Button on the Landing, THE Landing SHALL navigate to the Auth_Page instead of opening the "Próximamente" sheet.
3. THE "Iniciar sin cuenta" flow of the Landing SHALL keep its current behavior and SHALL NOT require an account.
4. WHEN the person creates an account or signs in, THE App SHALL leave the Local_Data untouched, because the migration of local data belongs to the spec `cloud-sync`.
5. THE App SHALL NOT block any existing feature behind a Session.

### Requirement 9: Configuración pública y manejo de tokens

**User Story:** Como mantenedor del proyecto, quiero la configuración pública en un archivo versionado y un manejo claro de los tokens, para que la app se entienda y no exponga secretos.

#### Acceptance Criteria

1. THE Auth_Config SHALL contain only public values: the User Pool ID, the public App Client ID, the Cognito domain, the redirect URIs and the endpoint of the OIDC_Bridge.
2. THE Auth_Config SHALL NOT contain any client secret, GitHub secret or Cognito App Client secret.
3. THE Auth_Service SHALL use a Cognito App Client without a client secret, because the App is a public client that uses PKCE.
4. WHEN the Auth_Tokens are received, THE Auth_Service SHALL store them in the browser of the device and SHALL load the Session from them on the next visit while they remain valid.
5. WHILE a Session exists and the access token is expired but the refresh token is valid, THE Auth_Service SHALL obtain new Auth_Tokens from Cognito using the refresh token without asking the person to sign in again.
6. WHEN the refresh token is expired or rejected, THE Auth_Service SHALL end the Session and display the Auth_Page for a new sign-in.
7. WHEN a Session is established, THE Auth_Service SHALL validate the ID token signature and claims (issuer, audience and expiry) before trusting the Display_Name and the correo.

### Requirement 10: Degradación elegante sin red o sin SDK

**User Story:** Como persona sin conexión o con un dispositivo limitado, quiero que la app siga funcionando aunque las cuentas no, para no quedarme sin mi jardín.

#### Acceptance Criteria

1. IF the Account_SDK fails to load from the CDN, THEN THE App SHALL keep working without an account and SHALL display the account controls disabled with a notice.
2. IF there is no network connection, THEN THE Auth_Page SHALL display the registration, sign-in and provider controls disabled with the notice "Necesitas conexión para usar tu cuenta".
3. WHILE the Account_SDK is unavailable, THE Account_Slot in the Settings_View SHALL display the disabled state with a notice and SHALL NOT fail the rest of the Settings_View.
4. WHEN the Account_SDK or the connection becomes available again, THE App SHALL enable the account controls without a reload.
5. THE App SHALL load the Account_SDK through a CDN with a fixed version, consistent with `dependencies-policy.md`.

### Requirement 11: Puente OIDC de GitHub como servicio Node/Express

**User Story:** Como mantenedor del proyecto, quiero el puente de GitHub como un servicio Node/Express con un contrato claro, para desplegarlo y mantenerlo sin tocar el frontend.

#### Acceptance Criteria

1. THE OIDC_Bridge SHALL be a Node.js service built with Express puro, separate from the frontend, without a frontend build step.
2. THE OIDC_Bridge SHALL expose the OIDC endpoints that Cognito requires of an OIDC identity provider, including the authorization endpoint, the token endpoint and the JSON Web Key Set endpoint.
3. THE OIDC_Bridge SHALL read the GitHub Client ID, the GitHub Client Secret and its signing keys from environment variables, and SHALL NOT read them from the Auth_Config.
4. WHEN the OIDC_Bridge receives a GitHub authorization, THE OIDC_Bridge SHALL exchange it with GitHub for the person's identity and SHALL issue an OIDC ID token that Cognito accepts.
5. THE OIDC_Bridge SHALL accept requests only from the configured Cognito redirect and allowed origins, and SHALL reject any other origin.
6. THE repository SHALL document how to run the OIDC_Bridge locally and which environment variables it requires.

### Requirement 12: Seguridad de la autenticación

**User Story:** Como persona que confía su identidad a la app, quiero que el inicio de sesión sea seguro, para que nadie suplante mi cuenta ni robe mis secretos.

#### Acceptance Criteria

1. THE Auth_Service SHALL use the authorization-code flow with PKCE for every provider and SHALL NOT use the implicit flow.
2. THE Auth_Service SHALL generate a fresh State_Value for each sign-in attempt and SHALL reject any redirect whose State_Value does not match.
3. THE Cognito App Client SHALL allow only the redirect URIs declared in the Auth_Config, and THE Auth_Service SHALL redirect only to those URIs.
4. THE frontend SHALL NOT contain any client secret, GitHub secret or Cognito App Client secret.
5. WHEN the Auth_Service receives tokens, THE Auth_Service SHALL validate the ID token signature against the Cognito JSON Web Key Set and SHALL reject tokens with an invalid issuer, audience or expiry.
6. THE OIDC_Bridge SHALL keep the GitHub secret and its signing keys on the server only, never sending them to the browser.

### Requirement 13: Documentación y actualización de steerings

**User Story:** Como mantenedor del proyecto, quiero que la documentación refleje las cuentas, para que el equipo y el agente `qa-tester` sepan qué verificar y qué cambió en el stack.

#### Acceptance Criteria

1. THE documentation SHALL add or update the README of the `accounts-auth` module with the sections Descripción, Pruebas para qa-tester and Changelog.
2. THE README of the `accounts-auth` module SHALL contain one test case, with steps and expected result, for each of Requirements 1 to 12.
3. THE documentation SHALL update `tech.md`, which today states "sin backend, sin build", to describe the Amazon Cognito integration, the Account_SDK loaded by CDN and the OIDC_Bridge Node/Express service.
4. THE documentation SHALL recognize the tension with principle 6 of `product.md` ("datos locales, sin cuentas ni servidor") and record that accounts are now optional and that local data stays local in this spec.
5. THE documentation SHALL update `docs/features.md` by moving `accounts-auth` from the roadmap to the available use cases.
6. THE documentation SHALL update `exercise/docs/current-plan.md` to mark the spec `accounts-auth` as implemented when the work is complete.
7. THE documentation SHALL record the Changelog entry of the `accounts-auth` module with the date and the version of the first release.

## Supuestos y notas

- **Alcance acotado.** Este spec cubre únicamente la autenticación. El guardado y la sincronización de datos (incluida la migración de los datos locales a la nube) son del spec 3 `cloud-sync`; la sección "Mis sesiones" y el control multidispositivo son del spec 4 `multi-device-sessions`. El 2FA se difiere y no entra aquí.
- **"AWS account" = Login with Amazon.** La pregunta abierta del plan ("¿qué significa AWS account?") se cierra como **Login with Amazon**, que Cognito integra de forma nativa como Social_Provider. No es iniciar con credenciales de IAM ni con IAM Identity Center.
- **GitHub necesita puente.** Cognito integra Google, Facebook (Meta), Apple y Login with Amazon de forma nativa, pero no GitHub. Por eso GitHub se resuelve con el OIDC_Bridge en Node/Express, el único backend que agrega este spec. Instagram no tiene login directo para este caso y se cubre con Meta (Facebook).
- **Datos locales intactos.** Crear cuenta o iniciar sesión no toca `localStorage`. La clave sigue siendo `jardin-movil:v1` y no cambia de forma en este spec; la posible subida a `jardin-movil:v2` con migración es del spec 3.
- **Cliente público, sin secreto.** La App usa un App Client de Cognito sin secreto porque es un cliente público en el navegador. La seguridad del flujo recae en PKCE, el State_Value y las redirect URIs permitidas. Los secretos (GitHub, firmas del puente) viven solo en el OIDC_Bridge, en variables de entorno.
- **Dónde se guardan los tokens.** Los Auth_Tokens se guardan en el navegador del dispositivo para restaurar la Session en la siguiente visita. El spec de diseño decidirá el almacenamiento concreto (por ejemplo `localStorage` o `sessionStorage`) y el refresco con el refresh token; los requisitos solo fijan el comportamiento, no el mecanismo.
- **Tensión con "Datos locales / sin servidor".** El principio de producto 6 y el stack de `tech.md` ("sin backend, sin build") entran en conflicto con este spec. Se resuelve documentando que las cuentas son opcionales, que los datos siguen siendo locales en esta iteración y que el único backend es el puente de GitHub. La actualización de `product.md`, `tech.md` y `dependencies-policy.md` forma parte del trabajo.
- **Degradación elegante.** Como todo recurso externo del proyecto, el Account_SDK y las cuentas degradan con gracia: sin red o sin SDK, la App sigue funcionando sin cuenta y los controles de cuenta se muestran deshabilitados con un aviso.
- **Reemplazos en la interfaz.** Este spec conecta el Create_Account_Button de la Landing (hoy `openComingSoonSheet` en `src/components/landing-sheets.js`) con la Auth_Page, y reemplaza el Reserved_Slot "Mi cuenta" de la Settings_View (`src/components/settings-view.js`) por el Account_Slot real. El Reserved_Slot "Mis sesiones" se queda "Próximamente".
- **Despliegue del puente.** El OIDC_Bridge es un servicio aparte; su despliegue concreto (dónde corre, cómo se publica) se decide en el diseño. Los requisitos fijan su contrato (endpoints OIDC, variables de entorno, secretos fuera del front) y su degradación (si no responde, el resto de métodos sigue funcionando).
