import { loader } from './loader';

let geocoder: google.maps.Geocoder;

const initGeocoder = async () => {
    await loader.importLibrary("geocoding");
    geocoder = new google.maps.Geocoder();
};

export const geocodeAddress = async (address: string): Promise<google.maps.GeocoderResult[] | undefined> => {
    if (!geocoder) {
        await initGeocoder();
    }

    return new Promise((resolve, reject) => {
        geocoder.geocode({ address }, (results, status) => {
            if (status === google.maps.GeocoderStatus.OK && results) {
                resolve(results);
            } else {
                reject(new Error(`Geocoding failed: ${status}`));
            }
        });
    });
};

export const geocodeAddresses = async (addressOne: string, addressTwo: string): Promise<{ resultOne: google.maps.GeocoderResult[] | undefined, resultTwo: google.maps.GeocoderResult[] | undefined }> => {
    try {
        const [resultOne, resultTwo] = await Promise.all([geocodeAddress(addressOne), geocodeAddress(addressTwo)]);
        return { resultOne, resultTwo };
    } catch (error) {
        return { resultOne: undefined, resultTwo: undefined };
    }
};
