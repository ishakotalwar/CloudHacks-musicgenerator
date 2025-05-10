with open("image.jpg", "rb") as image_file:
    import base64
    encoded_string = base64.b64encode(image_file.read()).decode()
    print(encoded_string)
