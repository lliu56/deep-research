---

This document shows the connection between deep research and the output pipeline
(Deep research pipeline) → 

1. Basically a A cron job that triggers once every {x} days
2. Contact Scraping flow  scraping {n} contacts (with a specified {data_structure}), with the given in {search_params) 
3. Contact verification (to ensure realness of the information & prevent hallucination) with the criteria given in {verify_contacts}

(connection to email flow app → basically the agent stores this info in shared db)

1. n verified contacts’ information are stored
---