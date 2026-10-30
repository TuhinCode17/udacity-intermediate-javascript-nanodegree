
// Create Dino Constructor

/*
 * A class acts as a blueprint for creating multiple Dino objects.
 * Each object (instance) has its own properties and values.
 */

class Dino {

    // Constructor: a special method inside a class.
    // It runs automatically when a new Dino instance is created.
    constructor(data) {

        // "this" refers to the new Dino instance being created and initialized.
        // "data" is the object passed into the constructor.

        // Assign properties from the incoming data object
        // to the new Dino instance.
        this.species = data.species;

        // Number() converts weight and height into numbers
        // so we can perform numerical comparisons.
        this.weight = Number(data.weight);
        this.height = Number(data.height);

        this.diet = data.diet;
        this.where = data.where;
        this.when = data.when;
        this.fact = data.fact;
    }  // Constructor ends here


    // IMPORTANT: Inside an instance method, "this" refers to
    // the Dino instance whose method is being called.
    // For example, this.weight refers to that instance's weight.

    // The "human" parameter receives the Human object created from the form.

    // Compare the Dino instance's weight with the Human's weight.
    compareWeight(human) {

        // Check whether the Dino weighs more than the Human.
        if (this.weight > human.weight) {

            const ratio = (this.weight / human.weight).toFixed(1);

            return `${this.species} weighs ${ratio} times as much as you.`;

        // Check whether the Human weighs more than the Dino.
        } else if (this.weight < human.weight) {

            const ratio = (human.weight / this.weight).toFixed(1);

            return `You weigh ${ratio} times as much as ${this.species}.`;

        // If neither is heavier, both have the same weight.
        } else {

            return `${this.species} weighs the same as you.`;

        } // Closes the else block

    } // Closes the compareWeight() method

    
    // Compare the Dino instance's diet with the Human's diet.
    compareDiet(human) {

        // Convert both diet values to lowercase before comparing.
        const dinoDiet = this.diet.toLowerCase();
        const humanDiet = human.diet.toLowerCase();

        // Check whether both have the same diet.
        if (dinoDiet === humanDiet) {

            return `${this.species} and you have the same diet.`;

        } else {

            return `${this.species} and you have different diets.`;

        } // Closes the else block

    } // Closes the compareDiet() method




    // Compare the Dino instance's height with the Human's height.
    // "this" refers to the Dino instance whose method is being called.
    compareHeight(human) {

        // Check whether the Dino is taller than the Human.
        if (this.height > human.height) {

            const ratio = (this.height / human.height).toFixed(1);

            return `${this.species} is ${ratio} times taller than you.`;

        // Check whether the Human is taller than the Dino.
        } else if (this.height < human.height) {

            const ratio = (human.height / this.height).toFixed(1);

            return `You are ${ratio} times taller than ${this.species}.`;

        // If neither is taller, both have the same height.
        } else {

            return `${this.species} is the same height as you.`;

        } // Closes the else block

    } // Closes the compareHeight() method


} // Closes the Dino class



/*
 * createTile(): creates one infographic tile using JavaScript.
 * It creates the heading and image, then returns the tile.
 */

function createTile(item, human) {

    // Create a new div element for the tile.
    const tile = document.createElement('div');

    // Assign the CSS class that styles the infographic tile.
    tile.className = 'grid-item';

    // Create the heading and image elements.
    const heading = document.createElement('h3');
    const image = document.createElement('img');
    // Create a paragraph element to display the Dino's fact.
    const fact = document.createElement('p');

    // Check whether the item is the Human or a Dino.
    if (item.name) {

        // Display the Human's name and image.
        heading.textContent = item.name;
        image.src = 'images/human.png';
        image.alt = item.name;

    } else {

        // Display the Dino's species and corresponding image.
        heading.textContent = item.species;
        image.src = `images/${item.species.toLowerCase()}.png`;
        image.alt = item.species;
       
        // The Pigeon must always display its special bird fact.
        if (item.species === 'Pigeon') {

            fact.textContent = 'All birds are dinosaurs.';

        } else {

            // Create an array containing six possible types of facts.
            const randomFacts = [
                item.fact,
                item.compareWeight(human),
                item.compareHeight(human),
                item.compareDiet(human),
                `Found in: ${item.where}.`,
                `Lived during: ${item.when}.`
            ];

            // Math.random() generates a random number between 0 and 1.
            // Math.floor() converts it into an array index from 0 to 5.
            const randomIndex = Math.floor(Math.random() * randomFacts.length);

            // Select and display one randomly chosen fact.
            fact.textContent = randomFacts[randomIndex];
        }


    }

    // Append the heading and image to the tile.
    tile.appendChild(heading);
    tile.appendChild(image);   
   
    // Human tile does not require a fact.   
    // Append the fact only for Dino tiles.   
    if (!item.name) {   
           tile.appendChild(fact);
     }        

    // Return the completed tile.
    return tile;
}


// Create Dino Objects


/*
 * Load dinosaur data from dino.json and create Dino instances.
 */

// An empty array to store our newly created Dino objects.
let dinoObjects = [];
let dinoDataLoaded = false;

fetch('dino.json')
    .then(response => response.json())  // .then() handles the successful result of a promise
    .then(data => {

        // map() goes through each record in the Dinos array
        // and creates a new Dino instance from each record.
        dinoObjects = data.Dinos.map(dinoRecord => {
            return new Dino(dinoRecord);
        });

        dinoDataLoaded = true;

        
    })
    .catch(error => {
        console.error('Error loading dinosaur data:', error);
    });






// Create Human Object

// Select the Compare Me button from the HTML document.
const compareButton = document.getElementById('btn');

// Select the empty grid container from the HTML document.
// We will append our nine infographic tiles inside this element.
const grid = document.getElementById('grid');

// Select the form that contains the Human input fields.
const form = document.getElementById('dino-compare');

// addEventListener() listens for a click event on the button.
// The callback function runs when the user clicks the button.
compareButton.addEventListener('click', function() {

        // Check whether the dinosaur data has finished loading.
        if (!dinoDataLoaded) {
            alert('Dinosaur data is still loading. Please wait and try again.');
            return;
        }

    /*
     * IIFE: Immediately Invoked Function Expression.
     * Collects the user's form data and returns a Human object.
     * It executes when the button's click event triggers this callback.
     */

    const human = (function() {

        // Retrieve the values entered by the user in the HTML form.
        const name = document.getElementById('name').value;

        // .value retrieves input values as strings.
        // Number() converts the numeric values into numbers.
        const feet = Number(document.getElementById('feet').value);
        const inches = Number(document.getElementById('inches').value);

        // Convert the human's height into inches.
        // 1 foot = 12 inches.
        // We use inches as the common unit for comparing heights.
        const height = (feet * 12) + inches;

        const weight = Number(document.getElementById('weight').value);
        const diet = document.getElementById('diet').value;

        // Return a plain JavaScript object containing the Human's data.
        return {
            name: name,
            height: height,
            weight: weight,
            diet: diet
        };

    })(); // () immediately invokes the function expression.

       

       
// Validate the Human's form data before generating the infographic.
const feetInput = document.getElementById('feet').value;
const inchesInput = document.getElementById('inches').value;
const weightInput = document.getElementById('weight').value;

const feet = Number(feetInput);
const inches = Number(inchesInput);
const weight = Number(weightInput);

// Check that all required fields have been filled in.
if (
    !human.name.trim() ||
    feetInput === '' ||
    inchesInput === '' ||
    weightInput === ''
) {
    alert('Please complete all the form fields.');
    return;
}

// Prevent invalid height and weight values.
if (
    !Number.isFinite(feet) ||
    !Number.isFinite(inches) ||
    !Number.isFinite(weight) ||
    feet < 0 ||
    inches < 0 ||
    inches >= 12 ||
    human.height <= 0 ||
    weight <= 0
) {
    alert('Please enter a valid height and weight.');
    return;
}

      // Create a copy of the Dino array after form validation succeeds.
      const infographicItems = dinoObjects.slice(); 
     

       // Insert the Human object at index 4 (the centre tile).
       infographicItems.splice(4, 0, human);

       
      // Generate and append all nine infographic tiles.
       infographicItems.forEach(item => {

      // Create a tile for the current item.
      const tile = createTile(item, human);

      // Append the newly created tile to the grid container.
      grid.appendChild(tile);

});

    // Remove the form from the DOM after generating the infographic.
    form.remove();

   
      

}); // Close the click event listener.





